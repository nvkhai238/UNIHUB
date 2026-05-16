package com.unihub.workshop.module.checkin.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.checkin.dto.CheckinLookupResponse;
import com.unihub.workshop.module.checkin.dto.CheckinResponse;
import com.unihub.workshop.module.checkin.dto.PreloadResponse;
import com.unihub.workshop.module.checkin.dto.SyncRequest;
import com.unihub.workshop.module.checkin.dto.SyncResponse;
import com.unihub.workshop.module.checkin.dto.WorkshopSummaryResponse;
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

    /**
     * Lấy danh sách workshops PUBLISHED diễn ra trong ngày `date`.
     * Mobile dùng để hiển thị dropdown cho staff chọn ca trước khi preload.
     */
    @GetMapping("/workshops")
    @PreAuthorize("hasRole('CHECKIN_STAFF')")
    public ResponseEntity<ApiResponse<List<WorkshopSummaryResponse>>> getWorkshopsByDate(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(ApiResponse.success(checkinService.getWorkshopsByDate(date)));
    }

    /**
     * Preload QR codes.
     * - `date`: ngày bắt đầu workshop (bắt buộc)
     * - `workshopId`: UUID workshop cụ thể (optional). Nếu có, chỉ preload QR của workshop đó.
     */
    @GetMapping("/preload")
    @PreAuthorize("hasRole('CHECKIN_STAFF')")
    public ResponseEntity<ApiResponse<List<PreloadResponse>>> preload(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(value = "workshopId", required = false) UUID workshopId
    ) {
        return ResponseEntity.ok(ApiResponse.success(checkinService.preloadCheckins(date, workshopId)));
    }

    /**
     * Tra cứu QR code online.
     * - `workshopId`: UUID workshop cụ thể (optional). Nếu có, validate QR phải thuộc đúng workshop đó.
     */
    @GetMapping("/lookup")
    @PreAuthorize("hasRole('CHECKIN_STAFF')")
    public ResponseEntity<ApiResponse<CheckinLookupResponse>> lookup(
            @RequestParam("qrCode") String qrCode,
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(value = "workshopId", required = false) UUID workshopId
    ) {
        return ResponseEntity.ok(ApiResponse.success(checkinService.lookupQr(qrCode, date, workshopId)));
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
