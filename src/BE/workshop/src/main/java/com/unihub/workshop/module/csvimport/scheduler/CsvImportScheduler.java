package com.unihub.workshop.module.csvimport.scheduler;

import com.unihub.workshop.module.studentimport.entity.StudentImportBatch;
import com.unihub.workshop.module.studentimport.repository.StudentImportBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;

@Component
@EnableScheduling
@RequiredArgsConstructor
public class CsvImportScheduler {

    private final JobLauncher jobLauncher;
    private final Job studentImportJob;
    private final StudentImportBatchRepository batchRepository;

    @Scheduled(cron = "0 0 2 * * *")
    public StudentImportBatch runImportJob() {
        StudentImportBatch batch = StudentImportBatch.builder()
                .fileName("students.csv")
                .status("RUNNING")
                .build();
        batch = batchRepository.save(batch);

        try {
            JobExecution execution = jobLauncher.run(studentImportJob, new JobParametersBuilder()
                    .addLong("time", System.currentTimeMillis())
                    .addString("batchId", batch.getId().toString())
                    .toJobParameters());

            batch.setStatus(execution.getStatus().name());
            
            long readCount = execution.getStepExecutions().stream().mapToLong(se -> se.getReadCount()).sum();
            long writeCount = execution.getStepExecutions().stream().mapToLong(se -> se.getWriteCount()).sum();
            long skipCount = execution.getStepExecutions().stream().mapToLong(se -> se.getSkipCount()).sum();

            batch.setTotalRows((int) readCount + (int) skipCount);
            batch.setSuccessRows((int) writeCount);
            batch.setErrorRows((int) skipCount);

        } catch (Exception e) {
            batch.setStatus("FAILED");
            batch.setErrorLog(e.getMessage());
        } finally {
            batch.setCompletedAt(ZonedDateTime.now());
            batch = batchRepository.save(batch);
        }
        return batch;
    }
}
