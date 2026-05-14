package com.unihub.workshop.module.checkin.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.checkin.dto.CheckinResponse;
import com.unihub.workshop.module.checkin.dto.CheckinLookupResponse;
import com.unihub.workshop.module.checkin.dto.PreloadResponse;
import com.unihub.workshop.module.checkin.dto.SyncRequest;
import com.unihub.workshop.module.checkin.dto.SyncResponse;
import com.unihub.workshop.module.checkin.entity.Checkin;
import com.unihub.workshop.module.checkin.repository.CheckinRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CheckinService {

    private final CheckinRepository checkinRepository;
    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;

    @Transactional(readOnly = true)
    public List<PreloadResponse> preloadCheckins(LocalDate date) {
        ZoneId localZone = ZoneId.systemDefault();
        List<Registration> registrations = registrationRepository.findByStatusAndQrCodeIsNotNull(RegistrationStatus.CONFIRMED)
                .stream()
                .filter(r -> r.getWorkshop().getStartTime()
                        .withZoneSameInstant(localZone)
                        .toLocalDate()
                        .equals(date))
                .toList();

        return registrations.stream()
                .map(r -> PreloadResponse.builder()
                        .qrCode(r.getQrCode())
                        .fullName(r.getUser().getFullName())
                        .workshopId(r.getWorkshop().getId())
                        .workshopTitle(r.getWorkshop().getTitle())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CheckinLookupResponse lookupQr(String qrCode, LocalDate selectedDate) {
        Optional<Registration> registrationOpt = registrationRepository.findByQrCode(qrCode);
        if (registrationOpt.isEmpty()) {
            return CheckinLookupResponse.builder()
                    .found(false)
                    .eligible(false)
                    .qrCode(qrCode)
                    .status("INVALID_QR")
                    .message("QR code does not match any registration")
                    .build();
        }

        Registration registration = registrationOpt.get();
        LocalDate workshopDate = registration.getWorkshop().getStartTime()
                .withZoneSameInstant(ZoneId.systemDefault())
                .toLocalDate();
        boolean confirmed = registration.getStatus() == RegistrationStatus.CONFIRMED;
        boolean sameDate = selectedDate == null || workshopDate.equals(selectedDate);
        boolean eligible = confirmed && sameDate;
        String status;
        String message;

        if (!confirmed) {
            status = "NOT_CONFIRMED";
            message = "Registration is not confirmed";
        } else if (!sameDate) {
            status = "WRONG_DATE";
            message = "QR belongs to workshop date " + workshopDate;
        } else {
            status = "ELIGIBLE";
            message = "QR is eligible for check-in";
        }

        return CheckinLookupResponse.builder()
                .found(true)
                .eligible(eligible)
                .qrCode(qrCode)
                .registrationId(registration.getId())
                .registrationStatus(registration.getStatus())
                .fullName(registration.getUser().getFullName())
                .studentId(registration.getUser().getStudentId())
                .workshopId(registration.getWorkshop().getId())
                .workshopTitle(registration.getWorkshop().getTitle())
                .workshopStartTime(registration.getWorkshop().getStartTime())
                .status(status)
                .message(message)
                .build();
    }

    @Transactional
    public SyncResponse syncCheckins(List<SyncRequest> records) {
        List<SyncResponse.Item> results = new ArrayList<>();
        int created = 0;
        int duplicate = 0;
        int conflict = 0;
        int invalid = 0;

        for (SyncRequest record : records) {
            Optional<Registration> registrationOpt = registrationRepository.findByQrCode(record.getQrCode());
            if (registrationOpt.isEmpty()) {
                invalid++;
                results.add(result(record, null, "INVALID_QR", "QR code does not match any registration"));
                continue;
            }

            Registration registration = registrationOpt.get();
            if (registration.getStatus() != RegistrationStatus.CONFIRMED) {
                invalid++;
                results.add(result(record, registration, "NOT_CONFIRMED", "Registration is not confirmed"));
                continue;
            }

            Optional<Checkin> existingCheckin = checkinRepository.findByRegistration(registration);
            if (existingCheckin.isPresent()) {
                Checkin existing = existingCheckin.get();
                boolean sameDevice = safeEquals(existing.getDeviceId(), record.getDeviceId());
                if (sameDevice) {
                    duplicate++;
                    results.add(result(record, registration, "DUPLICATE", "QR was already checked in by this device"));
                } else {
                    conflict++;
                    results.add(result(record, registration, "CONFLICT", "QR was already checked in by another device"));
                }
                continue;
            }

            try {
                Checkin checkin = Checkin.builder()
                        .registration(registration)
                        .checkedInAt(record.getTimestamp())
                        .syncedAt(ZonedDateTime.now())
                        .deviceId(record.getDeviceId())
                        .build();
                checkinRepository.save(checkin);
                created++;
                results.add(result(record, registration, "CREATED", "Check-in recorded"));
            } catch (DataIntegrityViolationException e) {
                conflict++;
                results.add(result(record, registration, "CONFLICT", "QR was checked in by another sync request"));
            }
        }

        return SyncResponse.builder()
                .total(records.size())
                .created(created)
                .duplicate(duplicate)
                .conflict(conflict)
                .invalid(invalid)
                .items(results)
                .build();
    }

    @Transactional(readOnly = true)
    public List<CheckinResponse> listByWorkshop(java.util.UUID workshopId) {
        Workshop workshop = workshopRepository.findById(workshopId)
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));
        return checkinRepository.findByRegistration_WorkshopOrderByCheckedInAtDesc(workshop).stream()
                .map(CheckinResponse::from)
                .toList();
    }

    private SyncResponse.Item result(SyncRequest record, Registration registration, String status, String message) {
        return SyncResponse.Item.builder()
                .qrCode(record.getQrCode())
                .registrationId(registration != null ? registration.getId() : null)
                .status(status)
                .message(message)
                .deviceId(record.getDeviceId())
                .checkedInAt(record.getTimestamp())
                .build();
    }

    private boolean safeEquals(String left, String right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }
}
