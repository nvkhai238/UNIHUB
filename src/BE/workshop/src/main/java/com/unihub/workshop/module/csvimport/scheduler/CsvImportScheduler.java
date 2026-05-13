package com.unihub.workshop.module.csvimport.scheduler;

import com.unihub.workshop.module.notification.service.EmailService;
import com.unihub.workshop.module.studentimport.entity.StudentImportBatch;
import com.unihub.workshop.module.studentimport.repository.StudentImportBatchRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Component
@EnableScheduling
@RequiredArgsConstructor
public class CsvImportScheduler {

    private final JobLauncher jobLauncher;
    private final Job studentImportJob;
    private final StudentImportBatchRepository batchRepository;
    private final EmailService emailService;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Value("${app.csv.data-dir:/data}")
    private String dataDir;

    private static final List<String> ACCEPTED_HEADERS = List.of(
            "student_id,full_name,email",
            "studentId,fullName,email"
    );
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern STUDENT_ID_PATTERN = Pattern.compile("^[0-9]{8}$");
    private static final Pattern STUDENT_FILE_PATTERN = Pattern.compile("students_\\d{4}-\\d{2}-\\d{2}\\.csv");
    private static final String IMPORT_TIME_ZONE = "Asia/Ho_Chi_Minh";
    private static final ZoneId IMPORT_ZONE_ID = ZoneId.of(IMPORT_TIME_ZONE);
    private final ReentrantLock importLock = new ReentrantLock();

    @Scheduled(cron = "0 0 2 * * *", zone = IMPORT_TIME_ZONE)
    public StudentImportBatch runImportJob() {
        return runImport(false);
    }

    public StudentImportBatch runManualImportJob() {
        return runImport(true);
    }

    private StudentImportBatch runImport(boolean allowLatestFileFallback) {
        CsvFileSelection fileSelection = selectCsvFile(allowLatestFileFallback);
        String fileName = fileSelection.fileName();
        String filePath = fileSelection.filePath();

        StudentImportBatch batch = StudentImportBatch.builder()
                .fileName(fileName)
                .status("RUNNING")
                .build();
        batch = batchRepository.save(batch);

        if (!importLock.tryLock()) {
            batch.setStatus("SKIPPED");
            batch.setTotalRows(0);
            batch.setSuccessRows(0);
            batch.setErrorRows(0);
            batch.setErrorLog("CSV import is already running.");
            batch.setCompletedAt(ZonedDateTime.now());
            return batchRepository.save(batch);
        }

        try {
            PreprocessResult preprocessResult = preprocessCsvFile(filePath);
            if (preprocessResult.validationError() != null) {
                batch.setStatus("SKIPPED");
                batch.setTotalRows(0);
                batch.setSuccessRows(0);
                batch.setErrorRows(0);
                batch.setErrorLog(preprocessResult.validationError());
                batch.setCompletedAt(ZonedDateTime.now());
                batch = batchRepository.save(batch);
                notifyCsvImportIssue(fileName, batch.getStatus(), preprocessResult.validationError());
                return batch;
            }

            try {
                JobExecution execution = jobLauncher.run(studentImportJob, new JobParametersBuilder()
                        .addLong("time", System.currentTimeMillis())
                        .addString("batchId", batch.getId().toString())
                        .addString("filePath", preprocessResult.sanitizedFilePath())
                        .toJobParameters());

                batch.setStatus(execution.getStatus().name());

                long writeCount = execution.getStepExecutions().stream().mapToLong(se -> se.getWriteCount()).sum();
                long skipCount = execution.getStepExecutions().stream().mapToLong(se -> se.getSkipCount()).sum();

                int totalRows = preprocessResult.totalRows();
                int errorRows = preprocessResult.errorRows() + (int) skipCount;

                batch.setTotalRows(totalRows);
                batch.setSuccessRows((int) writeCount);
                batch.setErrorRows(errorRows);

                String detailedErrorLog = buildErrorLog(preprocessResult.errorDetails(), (int) skipCount);
                if (errorRows > 0 && fileSelection.note() != null && !fileSelection.note().isBlank()) {
                    detailedErrorLog = detailedErrorLog.isBlank()
                            ? fileSelection.note()
                            : fileSelection.note() + "\n" + detailedErrorLog;
                }
                if (!detailedErrorLog.isBlank()) {
                    batch.setErrorLog(detailedErrorLog);
                }
                if (errorRows > 0 && !detailedErrorLog.isBlank()) {
                    notifyCsvImportIssue(fileName, batch.getStatus(), detailedErrorLog);
                }

            } catch (Exception e) {
                batch.setStatus("FAILED");
                batch.setErrorLog(e.getMessage());
                notifyCsvImportIssue(fileName, batch.getStatus(), e.getMessage());
            } finally {
                deleteTempFileQuietly(preprocessResult.sanitizedFilePath());
                batch.setCompletedAt(ZonedDateTime.now());
                batch = batchRepository.save(batch);
            }
            return batch;
        } finally {
            importLock.unlock();
        }
    }

    private PreprocessResult preprocessCsvFile(String filePath) {
        Path path = Path.of(filePath);
        if (!Files.exists(path)) {
            return PreprocessResult.invalid("CSV file not found: " + filePath);
        }

        try {
            if (Files.size(path) <= 0) {
                return PreprocessResult.invalid("CSV file is empty: " + filePath);
            }

            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            if (lines.isEmpty()) {
                return PreprocessResult.invalid("CSV file has no content: " + filePath);
            }

            String header = lines.get(0).trim().replace(" ", "");
            if (ACCEPTED_HEADERS.stream().noneMatch(header::equalsIgnoreCase)) {
                return PreprocessResult.invalid("CSV header is invalid. Expected student_id,full_name,email but got: " + lines.get(0).trim());
            }

            Map<String, String> latestValidRowsByStudentId = new LinkedHashMap<>();
            List<String> errorDetails = new ArrayList<>();

            for (int index = 1; index < lines.size(); index++) {
                String originalLine = lines.get(index);
                int lineNumber = index + 1;

                if (originalLine == null || originalLine.trim().isEmpty()) {
                    errorDetails.add("line " + lineNumber + ": empty row");
                    continue;
                }

                String[] parts = originalLine.split(",", -1);
                if (parts.length != 3) {
                    errorDetails.add("line " + lineNumber + ": expected 3 columns but got " + parts.length);
                    continue;
                }

                String studentId = parts[0].trim();
                String fullName = parts[1].trim();
                String email = parts[2].trim().toLowerCase();

                String lineError = validateCsvRow(studentId, fullName, email);
                if (lineError != null) {
                    errorDetails.add("line " + lineNumber + ": " + lineError);
                    continue;
                }

                if (latestValidRowsByStudentId.containsKey(studentId)) {
                    latestValidRowsByStudentId.remove(studentId);
                }
                latestValidRowsByStudentId.put(studentId, studentId + "," + fullName + "," + email);
            }

            List<String> sanitizedLines = new ArrayList<>();
            sanitizedLines.add("studentId,fullName,email");
            sanitizedLines.addAll(latestValidRowsByStudentId.values());

            Path tempDirPath = Path.of(dataDir, ".tmp");
            Files.createDirectories(tempDirPath);
            Path sanitizedFile = Files.createTempFile(tempDirPath, "students_import_", ".csv");
            Files.write(sanitizedFile, sanitizedLines, StandardCharsets.UTF_8);

            return new PreprocessResult(
                    sanitizedFile.toString(),
                    lines.size() - 1,
                    errorDetails.size(),
                    errorDetails,
                    null
            );
        } catch (IOException e) {
            return PreprocessResult.invalid("Could not read CSV file: " + e.getMessage());
        }
    }

    private void notifyCsvImportIssue(String fileName, String status, String errorLog) {
        String safeError = errorLog == null ? "No detail provided." : errorLog;
        emailService.sendAdminCsvImportAlert(
                "[UniHub] CSV import " + status + " - " + fileName,
                """
                <!doctype html>
                <html lang="en">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2>CSV import issue detected</h2>
                  <p><strong>File:</strong> %s</p>
                  <p><strong>Status:</strong> %s</p>
                  <p><strong>Detail:</strong> %s</p>
                </body>
                </html>
                """.formatted(fileName, status, safeError)
        );
    }

    private String validateCsvRow(String studentId, String fullName, String email) {
        if (studentId.isBlank()) {
            return "student_id is blank";
        }
        if (!STUDENT_ID_PATTERN.matcher(studentId).matches()) {
            return "student_id must contain exactly 8 digits";
        }
        if (fullName.isBlank()) {
            return "full_name is blank";
        }
        if (fullName.length() > 255) {
            return "full_name exceeds 255 characters";
        }
        if (email.isBlank()) {
            return "email is blank";
        }
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            return "email format is invalid";
        }

        Optional<User> emailOwner = userRepository.findByEmail(email);
        if (emailOwner.isPresent() && !studentId.equals(emailOwner.get().getStudentId())) {
            return "email is already used by another account";
        }

        Optional<User> existingUser = userRepository.findByStudentId(studentId);
        if (existingUser.isPresent() && existingUser.get().getRole() != UserRole.STUDENT) {
            return "student_id belongs to a non-student account";
        }

        return null;
    }

    private String buildErrorLog(List<String> preprocessErrors, int batchSkipCount) {
        List<String> combined = new ArrayList<>(preprocessErrors);
        if (batchSkipCount > 0) {
            combined.add("runtime: " + batchSkipCount + " row(s) were skipped by Spring Batch during processing");
        }
        return String.join("\n", combined);
    }

    private CsvFileSelection selectCsvFile(boolean allowLatestFileFallback) {
        String expectedFileName = "students_" + LocalDate.now(IMPORT_ZONE_ID) + ".csv";
        Path expectedPath = Path.of(dataDir, expectedFileName);
        if (Files.exists(expectedPath) || !allowLatestFileFallback) {
            return new CsvFileSelection(expectedFileName, expectedPath.toString(), null);
        }

        Optional<Path> latestCsv = findLatestCsvFile();
        if (latestCsv.isEmpty()) {
            return new CsvFileSelection(expectedFileName, expectedPath.toString(), null);
        }

        Path selectedPath = latestCsv.get();
        String selectedFileName = selectedPath.getFileName().toString();
        return new CsvFileSelection(
                selectedFileName,
                selectedPath.toString(),
                "Manual import used latest available CSV because today's file was not found: " + expectedFileName
        );
    }

    private Optional<Path> findLatestCsvFile() {
        Path dir = Path.of(dataDir);
        if (!Files.isDirectory(dir)) {
            return Optional.empty();
        }

        try (Stream<Path> files = Files.list(dir)) {
            return files
                    .filter(Files::isRegularFile)
                    .filter(path -> STUDENT_FILE_PATTERN.matcher(path.getFileName().toString()).matches())
                    .max(Comparator.comparing(path -> path.getFileName().toString()));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    private void deleteTempFileQuietly(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(filePath));
        } catch (IOException ignored) {
        }
    }

    private record PreprocessResult(
            String sanitizedFilePath,
            int totalRows,
            int errorRows,
            List<String> errorDetails,
            String validationError
    ) {
        private static PreprocessResult invalid(String validationError) {
            return new PreprocessResult(null, 0, 0, List.of(), validationError);
        }
    }

    private record CsvFileSelection(String fileName, String filePath, String note) {
    }
}
