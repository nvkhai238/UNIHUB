package com.unihub.workshop.module.checkin.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.checkin.dto.CheckinResponse;
import com.unihub.workshop.module.checkin.dto.PreloadResponse;
import com.unihub.workshop.module.checkin.dto.SyncRequest;
import com.unihub.workshop.module.checkin.dto.SyncResponse;
import com.unihub.workshop.module.checkin.service.CheckinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/checkins")
@RequiredArgsConstructor
public class CheckinController {

    private final CheckinService checkinService;

    @GetMapping("/preload")
    @PreAuthorize("hasRole('CHECKIN_STAFF')")
    public ResponseEntity<ApiResponse<List<PreloadResponse>>> preload(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(ApiResponse.success(checkinService.preloadCheckins(date)));
    }

    @PostMapping("/sync")
    @PreAuthorize("hasRole('CHECKIN_STAFF')")
    public ResponseEntity<ApiResponse<SyncResponse>> sync(
            @RequestBody @Valid List<SyncRequest> records
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Check-ins synchronized successfully",
                checkinService.syncCheckins(records)
        ));
    }

    @GetMapping("/workshops/{workshopId}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<List<CheckinResponse>>> listByWorkshop(@PathVariable UUID workshopId) {
        return ResponseEntity.ok(ApiResponse.success(checkinService.listByWorkshop(workshopId)));
    }
}
