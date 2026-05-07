package com.unihub.workshop.module.studentimport.repository;

import com.unihub.workshop.module.studentimport.entity.StudentImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface StudentImportBatchRepository extends JpaRepository<StudentImportBatch, UUID> {
}
