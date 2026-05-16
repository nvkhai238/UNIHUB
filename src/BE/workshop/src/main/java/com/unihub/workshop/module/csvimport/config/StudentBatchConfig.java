package com.unihub.workshop.module.csvimport.config;

import com.unihub.workshop.module.csvimport.dto.StudentCsvDTO;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.file.FlatFileItemReader;
import org.springframework.batch.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Pattern;

@Configuration
@RequiredArgsConstructor
public class StudentBatchConfig {

    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final PasswordEncoder passwordEncoder;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern STUDENT_ID_PATTERN = Pattern.compile("^[0-9]{8}$");

    @Bean
    @StepScope
    public FlatFileItemReader<StudentCsvDTO> studentReader(
            @Value("#{jobParameters['filePath']}") String filePath
    ) {
        String resolvedFilePath = (filePath == null || filePath.isBlank())
                ? "/data/students_" + LocalDate.now() + ".csv"
                : filePath;

        return new FlatFileItemReaderBuilder<StudentCsvDTO>()
                .name("studentItemReader")
                .resource(new FileSystemResource(resolvedFilePath))
                .delimited()
                .names("studentId", "fullName", "email")
                .linesToSkip(1)
                .targetType(StudentCsvDTO.class)
                .build();
    }

    @Bean
    public ItemProcessor<StudentCsvDTO, User> studentProcessor() {
        return item -> {
            if (item.getEmail() == null || !EMAIL_PATTERN.matcher(item.getEmail()).matches()) {
                return null;
            }
            if (item.getStudentId() == null || item.getStudentId().trim().isEmpty()) {
                return null;
            }
            if (item.getFullName() == null || item.getFullName().trim().isEmpty()) {
                return null;
            }

            String studentId = item.getStudentId().trim();
            String fullName = item.getFullName().trim();
            String email = item.getEmail().trim().toLowerCase();

            if (!STUDENT_ID_PATTERN.matcher(studentId).matches() || fullName.length() > 255) {
                return null;
            }

            Optional<User> emailOwner = userRepository.findByEmail(email);
            if (emailOwner.isPresent() && !studentId.equals(emailOwner.get().getStudentId())) {
                return null;
            }

            Optional<User> existingUserOpt = userRepository.findByStudentId(studentId);
            if (existingUserOpt.isPresent()) {
                User existingUser = existingUserOpt.get();
                if (existingUser.getRole() != UserRole.STUDENT) {
                    return null;
                }
                if (Boolean.TRUE.equals(existingUser.getIsActive()) && !existingUser.getEmail().equalsIgnoreCase(email)) {
                    return null;
                }
                existingUser.setFullName(fullName);
                existingUser.setEmail(email);
                return existingUser;
            } else {
                return User.builder()
                        .studentId(studentId)
                        .fullName(fullName)
                        .email(email)
                        .role(UserRole.STUDENT)
                        .isActive(true)
                        .password(passwordEncoder.encode(studentId + "@UniHub"))
                        .build();
            }
        };
    }

    @Bean
    public ItemWriter<User> studentWriter() {
        return items -> userRepository.saveAll(items);
    }

    @Bean
    public Step studentImportStep(FlatFileItemReader<StudentCsvDTO> studentReader) {
        return new StepBuilder("studentImportStep", jobRepository)
                .<StudentCsvDTO, User>chunk(100, transactionManager)
                .reader(studentReader)
                .processor(studentProcessor())
                .writer(studentWriter())
                .faultTolerant()
                .skip(Exception.class)
                .skipLimit(1000)
                .build();
    }

    @Bean
    public Job studentImportJob(Step studentImportStep) {
        return new JobBuilder("studentImportJob", jobRepository)
                .start(studentImportStep)
                .build();
    }
}
