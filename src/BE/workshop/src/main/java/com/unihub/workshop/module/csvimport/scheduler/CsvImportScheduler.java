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
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Component
@EnableScheduling
@RequiredArgsConstructor
public class CsvImportScheduler {

    private final JobLauncher jobLauncher;
    private final Job studentImportJob;
    private final StudentImportBatchRepository batchRepository;
    private final EmailService emailService;
    private final UserRepository userRepository;

    private static final List<String> ACCEPTED_HEADERS = List.of(
            "student_id,full_name,email",
            "studentId,fullName,email"
    );
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern STUDENT_ID_PATTERN = Pattern.compile("^[0-9]{8}$");

    @Scheduled(cron = "0 0 2 * * *")
    public StudentImportBatch runImportJob() {
        String fileName = "students_" + LocalDate.now() + ".csv";
        String filePath = "/data/" + fileName;

        StudentImportBatch batch = StudentImportBatch.builder()
                .fileName(fileName)
                .status("RUNNING")
                .build();
        batch = batchRepository.save(batch);

        PreprocessResult preprocessResult = preprocessCsvFile(filePath);
        if (preprocessResult.validationError() != null) {
            batch.setStatus("SKIPPED");
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
            if (errorRows > 0 && !detailedErrorLog.isBlank()) {
                batch.setErrorLog(detailedErrorLog);
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

            List<String> sanitizedLines = new ArrayList<>();
            List<String> errorDetails = new ArrayList<>();
            sanitizedLines.add("studentId,fullName,email");

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

                sanitizedLines.add(studentId + "," + fullName + "," + email);
            }

            Path tempDir = Path.of("/data/.tmp");
            Files.createDirectories(tempDir);
            Path sanitizedFile = Files.createTempFile(tempDir, "students_import_", ".csv");
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
}
