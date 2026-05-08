package com.unihub.workshop.module.csvimport.config;

import com.unihub.workshop.module.csvimport.dto.StudentCsvDTO;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.Optional;
import java.util.regex.Pattern;

@Configuration
@RequiredArgsConstructor
public class StudentBatchConfig {

    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");

    @Bean
    public ItemReader<StudentCsvDTO> studentReader() {
        return new FlatFileItemReaderBuilder<StudentCsvDTO>()
                .name("studentItemReader")
                .resource(new ClassPathResource("students.csv"))
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
                        .password("")
                        .build();
            }
        };
    }

    @Bean
    public ItemWriter<User> studentWriter() {
        return items -> userRepository.saveAll(items);
    }

    @Bean
    public Step studentImportStep() {
        return new StepBuilder("studentImportStep", jobRepository)
                .<StudentCsvDTO, User>chunk(100, transactionManager)
                .reader(studentReader())
                .processor(studentProcessor())
                .writer(studentWriter())
                .faultTolerant()
                .skip(Exception.class)
                .skipLimit(1000)
                .build();
    }

    @Bean
    public Job studentImportJob() {
        return new JobBuilder("studentImportJob", jobRepository)
                .start(studentImportStep())
                .build();
    }
}
