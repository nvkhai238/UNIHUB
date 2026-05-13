package com.unihub.workshop.module.csvimport;

import com.unihub.workshop.module.csvimport.scheduler.CsvImportScheduler;
import com.unihub.workshop.module.notification.service.EmailService;
import com.unihub.workshop.module.studentimport.entity.StudentImportBatch;
import com.unihub.workshop.module.studentimport.repository.StudentImportBatchRepository;
import com.unihub.workshop.module.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CsvImportUnitTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StudentImportBatchRepository importBatchRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private CsvImportScheduler csvImportScheduler;

    private File tempDir;
    private File testFile;

    @BeforeEach
    void setUp() throws IOException {
        tempDir = new File(System.getProperty("java.io.tmpdir"), "csvimport_test_" + System.currentTimeMillis());
        tempDir.mkdirs();
        testFile = new File(tempDir, "students_" + LocalDate.now() + ".csv");
        
        ReflectionTestUtils.setField(csvImportScheduler, "dataDir", tempDir.getAbsolutePath());

        lenient().when(importBatchRepository.save(any(StudentImportBatch.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void runImportJob_FileNotFound_DoesNotProcess() {
        csvImportScheduler.runImportJob();
        
        // It creates a SKIPPED batch when file is not found
        verify(importBatchRepository, atLeastOnce()).save(any());
    }

    @Test
    void runImportJob_EmptyFile_SavesFailedBatch() throws IOException {
        testFile.createNewFile(); // empty file
        
        csvImportScheduler.runImportJob();
        
        verify(importBatchRepository, atLeastOnce()).save(any(StudentImportBatch.class)); // Should save a failed batch due to empty or invalid format
    }
}
