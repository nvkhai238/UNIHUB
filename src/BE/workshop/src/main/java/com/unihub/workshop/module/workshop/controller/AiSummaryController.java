package com.unihub.workshop.module.workshop.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.workshop.dto.AiSummaryResponse;
import com.unihub.workshop.module.workshop.service.WorkshopService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai-summary")
@RequiredArgsConstructor
public class AiSummaryController {

    private final WorkshopService workshopService;

    @GetMapping("/{workshopId}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<AiSummaryResponse>> getAiSummary(@PathVariable UUID workshopId) {
        return ResponseEntity.ok(ApiResponse.success(AiSummaryResponse.from(workshopService.findById(workshopId))));
    }
}
