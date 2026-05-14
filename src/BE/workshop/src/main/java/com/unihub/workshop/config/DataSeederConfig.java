package com.unihub.workshop.config;

import com.unihub.workshop.module.checkin.entity.Checkin;
import com.unihub.workshop.module.checkin.repository.CheckinRepository;
import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.notification.repository.NotificationRepository;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeederConfig implements CommandLineRunner {

    private final UserRepository userRepository;
    private final WorkshopRepository workshopRepository;
    private final RegistrationRepository registrationRepository;
    private final PaymentRepository paymentRepository;
    private final CheckinRepository checkinRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Seeding sample data...");
        seedUsers();
        if (workshopRepository.count() == 0) {
            seedWorkshops();
            seedRegistrations();
            seedPayments();
            seedCheckins();
        }
        seedFreeCheckinDemoForMay14();
        seedNotifications();
        log.info("Seed data complete.");
    }

    private void seedUsers() {
        upsertUser("organizer@unihub.edu.vn", null, "Nguyễn Văn BTC", "admin123", UserRole.ORGANIZER);
        upsertUser("staff@unihub.edu.vn", null, "Trần Thị Checkin", "staff123", UserRole.CHECKIN_STAFF);
        upsertUser("21521001@university.edu.vn", "21521001", "Lê Minh Tuấn", "21521001@UniHub", UserRole.STUDENT);
        upsertUser("21521002@university.edu.vn", "21521002", "Phạm Thu Hà", "21521002@UniHub", UserRole.STUDENT);
        upsertUser("21521003@university.edu.vn", "21521003", "Hoàng Đình Nam", "21521003@UniHub", UserRole.STUDENT);
        upsertUser("21521004@university.edu.vn", "21521004", "Ngô Thảo Vy", "21521004@UniHub", UserRole.STUDENT);
        upsertUser("21521005@university.edu.vn", "21521005", "Đặng Quang Huy", "21521005@UniHub", UserRole.STUDENT);
        log.info("Seeded {} users", userRepository.count());
    }

    private void upsertUser(String email, String studentId, String fullName, String password, UserRole role) {
        User existing = userRepository.findByEmail(email).orElse(null);
        User user;
        if (existing != null) {
            existing.setPassword(passwordEncoder.encode(password));
            existing.setFullName(fullName);
            existing.setStudentId(studentId);
            user = entityManager.merge(existing);
        } else {
            user = User.builder()
                    .email(email)
                    .studentId(studentId)
                    .fullName(fullName)
                    .password(passwordEncoder.encode(password))
                    .role(role)
                    .isActive(true)
                    .build();
            user = entityManager.merge(user);
        }
        log.debug("Upserted user: {} with role {}", email, role);
    }

    private void seedWorkshops() {
        User organizer = userRepository.findByEmail("organizer@unihub.edu.vn").orElseThrow();
        ZonedDateTime now = ZonedDateTime.now();

        Workshop ws1 = workshopRepository.save(Workshop.builder()
                .title("AI trong Giáo dục: Từ Lý thuyết đến Thực hành")
                .description("Khám phá các ứng dụng thực tế của AI trong lớp học, từ trợ giảng thông minh đến hệ thống gợi ý học tập cá nhân hóa.")
                .speakerName("TS. Nguyễn Hoàng Nam")
                .speakerBio("Tiến sĩ AI tại ĐH Bách Khoa với 15 năm nghiên cứu và giảng dạy.")
                .room("B4-301")
                .startTime(now.plusDays(2).withHour(9).withMinute(0))
                .endTime(now.plusDays(2).withHour(11).withMinute(0))
                .capacity(60)
                .remainingSeats(12)
                .price(BigDecimal.ZERO)
                .status(WorkshopStatus.PUBLISHED)
                .aiSummary("Workshop tập trung vào 3 chủ đề chính: (1) AI trong đánh giá học tập; (2) Hệ thống gợi ý cá nhân hóa; (3) Công cụ AI cho sinh viên.")
                .aiSummaryStatus("DONE")
                .createdBy(organizer)
                .build());

        Workshop ws2 = workshopRepository.save(Workshop.builder()
                .title("Kỹ năng Phỏng vấn Việc làm IT 2026")
                .description("Buổi workshop thực hành với các tình huống phỏng vấn thực tế từ nhà tuyển dụng FPT, Viettel, VNPay.")
                .speakerName("Nguyễn Thị Mai Linh")
                .speakerBio("HRBP tại FPT Software với 8 năm kinh nghiệm tuyển dụng kỹ sư phần mềm.")
                .room("B5-102")
                .startTime(now.plusDays(1).withHour(14).withMinute(0))
                .endTime(now.plusDays(1).withHour(17).withMinute(0))
                .capacity(80)
                .remainingSeats(45)
                .price(new BigDecimal("100000"))
                .status(WorkshopStatus.PUBLISHED)
                .aiSummaryStatus("NONE")
                .createdBy(organizer)
                .build());

        Workshop ws3 = workshopRepository.save(Workshop.builder()
                .title("Docker & Kubernetes Cho Người Mới Bắt Đầu")
                .description("Từ container cơ bản đến triển khai ứng dụng lên Kubernetes cluster thực tế.")
                .speakerName("ThS. Lê Đình Phong")
                .speakerBio("DevOps Engineer tại Shopee với 6 năm kinh nghiệm với Docker, K8s.")
                .room("B3-205")
                .startTime(now.minusDays(3).withHour(8).withMinute(0))
                .endTime(now.minusDays(3).withHour(12).withMinute(0))
                .capacity(40)
                .remainingSeats(0)
                .price(new BigDecimal("50000"))
                .status(WorkshopStatus.CANCELLED)
                .createdBy(organizer)
                .build());

        Workshop ws4 = workshopRepository.save(Workshop.builder()
                .title("UX Design: Thiết kế Trải nghiệm Người dùng Từ Zero đến Hero")
                .description("Học cách sử dụng Figma từ cơ bản đến nâng cao, xây dựng persona, journey map và prototype.")
                .speakerName("Trần Đức Anh")
                .speakerBio("Lead UX Designer tại Tiki, tốt nghiệp HCI tại University of Tokyo.")
                .room("B6-401")
                .startTime(now.plusDays(5).withHour(13).withMinute(30))
                .endTime(now.plusDays(5).withHour(16).withMinute(0))
                .capacity(50)
                .remainingSeats(38)
                .price(BigDecimal.ZERO)
                .status(WorkshopStatus.PUBLISHED)
                .aiSummaryStatus("NONE")
                .createdBy(organizer)
                .build());

        Workshop ws5 = workshopRepository.save(Workshop.builder()
                .title("Blockchain và Ứng dụng Web3 trong Thực tế")
                .description("Từ Bitcoin đến Smart Contract, tìm hiểu cách blockchain hoạt động và các ứng dụng thực tế của Web3 ngoài tiền mã hóa.")
                .speakerName("TS. Võ Minh Đức")
                .speakerBio("Nhà nghiên cứu Blockchain tại Viện Khoa học VN.")
                .room("B2-103")
                .startTime(now.plusDays(10).withHour(9).withMinute(0))
                .endTime(now.plusDays(10).withHour(12).withMinute(0))
                .capacity(60)
                .remainingSeats(60)
                .price(new BigDecimal("150000"))
                .status(WorkshopStatus.DRAFT)
                .aiSummaryStatus("NONE")
                .createdBy(organizer)
                .build());

        Workshop ws6 = workshopRepository.save(Workshop.builder()
                .title("Python cho Khoa học Dữ liệu: Pandas, NumPy, Matplotlib")
                .description("Workshop thực hành sử dụng Python để phân tích dữ liệu, trực quan hóa và xây dựng mô hình Machine Learning cơ bản.")
                .speakerName("TS. Phạm Thị Lan")
                .speakerBio("Data Scientist tại VNG, giảng viên môn Khoa học Dữ liệu tại ĐH KHTN.")
                .room("C1-201")
                .startTime(now.plusDays(7).withHour(8).withMinute(30))
                .endTime(now.plusDays(7).withHour(11).withMinute(30))
                .capacity(70)
                .remainingSeats(52)
                .price(new BigDecimal("80000"))
                .status(WorkshopStatus.PUBLISHED)
                .aiSummaryStatus("NONE")
                .createdBy(organizer)
                .build());

        log.info("Seeded {} workshops", workshopRepository.count());
    }

    private void seedRegistrations() {
        List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.STUDENT)
                .toList();
        List<Workshop> publishedWorkshops = workshopRepository.findAll().stream()
                .filter(w -> w.getStatus() == WorkshopStatus.PUBLISHED)
                .toList();

        if (students.isEmpty() || publishedWorkshops.isEmpty()) return;

        Registration pendingReg = registrationRepository.save(Registration.builder()
                .user(students.get(0))
                .workshop(publishedWorkshops.get(1))
                .status(RegistrationStatus.PENDING)
                .registeredAt(ZonedDateTime.now().minusHours(12))
                .build());

        registrationRepository.save(Registration.builder()
                .user(students.get(0))
                .workshop(publishedWorkshops.get(0))
                .status(RegistrationStatus.CONFIRMED)
                .qrCode(UUID.randomUUID().toString())
                .registeredAt(ZonedDateTime.now().minusDays(3))
                .confirmedAt(ZonedDateTime.now().minusDays(3))
                .build());

        registrationRepository.save(Registration.builder()
                .user(students.get(1))
                .workshop(publishedWorkshops.get(0))
                .status(RegistrationStatus.CONFIRMED)
                .qrCode(UUID.randomUUID().toString())
                .registeredAt(ZonedDateTime.now().minusDays(2))
                .confirmedAt(ZonedDateTime.now().minusDays(2))
                .build());

        registrationRepository.save(Registration.builder()
                .user(students.get(2))
                .workshop(publishedWorkshops.get(1))
                .status(RegistrationStatus.CONFIRMED)
                .qrCode(UUID.randomUUID().toString())
                .registeredAt(ZonedDateTime.now().minusDays(1))
                .confirmedAt(ZonedDateTime.now().minusDays(1))
                .build());

        registrationRepository.save(Registration.builder()
                .user(students.get(3))
                .workshop(publishedWorkshops.get(2))
                .status(RegistrationStatus.CONFIRMED)
                .qrCode(UUID.randomUUID().toString())
                .registeredAt(ZonedDateTime.now().minusHours(6))
                .confirmedAt(ZonedDateTime.now().minusHours(6))
                .build());

        paymentRepository.save(Payment.builder()
                .registration(pendingReg)
                .idempotencyKey(UUID.randomUUID().toString())
                .amount(new BigDecimal("100000"))
                .status(PaymentStatus.PENDING)
                .build());

        log.info("Seeded {} registrations, {} payments",
                registrationRepository.count(), paymentRepository.count());
    }

    private void seedPayments() {}

    private void seedFreeCheckinDemoForMay14() {
        User organizer = userRepository.findByEmail("organizer@unihub.edu.vn").orElseThrow();
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        String title = "Demo Check-in Free 14/05/2026";

        Workshop workshop = workshopRepository.findByTitle(title).orElseGet(() -> Workshop.builder()
                .title(title)
                .description("Workshop free cố định ngày 14/05/2026 để test preload QR và mobile check-in offline.")
                .speakerName("UniHub Demo")
                .speakerBio("Dữ liệu mẫu cho luồng check-in.")
                .room("DEMO-101")
                .capacity(30)
                .remainingSeats(30)
                .price(BigDecimal.ZERO)
                .status(WorkshopStatus.PUBLISHED)
                .aiSummaryStatus("NONE")
                .createdBy(organizer)
                .build());

        workshop.setStartTime(ZonedDateTime.of(2026, 5, 14, 9, 0, 0, 0, zone));
        workshop.setEndTime(ZonedDateTime.of(2026, 5, 14, 11, 0, 0, 0, zone));
        workshop.setPrice(BigDecimal.ZERO);
        workshop.setStatus(WorkshopStatus.PUBLISHED);
        workshop.setCapacity(30);
        workshop = workshopRepository.save(workshop);
        final Workshop demoWorkshop = workshop;

        List<User> demoStudents = List.of(
                userRepository.findByEmail("21521001@university.edu.vn").orElseThrow(),
                userRepository.findByEmail("21521002@university.edu.vn").orElseThrow(),
                userRepository.findByEmail("21521003@university.edu.vn").orElseThrow()
        );

        int created = 0;
        for (User student : demoStudents) {
            Registration registration = registrationRepository.findByUserAndWorkshop(student, demoWorkshop)
                    .orElseGet(() -> Registration.builder()
                            .user(student)
                            .workshop(demoWorkshop)
                            .registeredAt(ZonedDateTime.now())
                            .build());
            if (registration.getQrCode() == null) {
                registration.setQrCode(UUID.randomUUID().toString());
            }
            registration.setStatus(RegistrationStatus.CONFIRMED);
            registration.setConfirmedAt(registration.getConfirmedAt() != null ? registration.getConfirmedAt() : ZonedDateTime.now());
            registration.setCancelledAt(null);
            registrationRepository.save(registration);
            created++;
        }

        long confirmedCount = registrationRepository.findByWorkshop(demoWorkshop).stream()
                .filter(r -> r.getStatus() == RegistrationStatus.CONFIRMED)
                .count();
        demoWorkshop.setRemainingSeats(Math.max(0, demoWorkshop.getCapacity() - (int) confirmedCount));
        workshopRepository.save(demoWorkshop);
        log.info("Seeded demo check-in workshop {} with {} confirmed free registrations", title, created);
    }

    private void seedCheckins() {
        Registration confirmedReg = registrationRepository.findAll().stream()
                .filter(r -> r.getStatus() == RegistrationStatus.CONFIRMED)
                .findFirst().orElse(null);

        if (confirmedReg != null) {
            checkinRepository.save(Checkin.builder()
                    .registration(confirmedReg)
                    .checkedInAt(ZonedDateTime.now().minusHours(1))
                    .syncedAt(ZonedDateTime.now().minusHours(1))
                    .deviceId("device-seed-001")
                    .build());
        }
        log.info("Seeded {} checkins", checkinRepository.count());
    }

    private void seedNotifications() {
        User student1 = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.STUDENT)
                .findFirst().orElse(null);

        User organizer = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ORGANIZER)
                .findFirst().orElse(null);

        if (student1 != null) {
            Workshop aiWorkshop = workshopRepository.findAll().stream()
                    .filter(w -> w.getTitle().contains("AI"))
                    .findFirst().orElse(null);

            notificationRepository.save(Notification.builder()
                    .user(student1)
                    .type(Notification.NotificationType.REGISTRATION_CONFIRMED)
                    .title("Xác nhận đăng ký thành công")
                    .body("Bạn đã đăng ký thành công workshop \"AI trong Giáo dục\". Mã QR đã sẵn sàng để check-in.")
                    .read(false)
                    .data(aiWorkshop != null ? Map.of("workshopId", aiWorkshop.getId().toString()) : Map.of())
                    .build());

            Registration pendingReg = registrationRepository.findAll().stream()
                    .filter(r -> r.getStatus() == RegistrationStatus.PENDING)
                    .findFirst().orElse(null);

            notificationRepository.save(Notification.builder()
                    .user(student1)
                    .type(Notification.NotificationType.PAYMENT_PENDING)
                    .title("Thanh toán đang chờ xử lý")
                    .body("Workshop \"Kỹ năng Phỏng vấn Việc làm IT 2026\" yêu cầu thanh toán 100.000đ. Vui lòng hoàn tất trong 15 phút.")
                    .read(false)
                    .data(pendingReg != null ? Map.of("registrationId", pendingReg.getId().toString()) : Map.of())
                    .build());

            notificationRepository.save(Notification.builder()
                    .user(student1)
                    .type(Notification.NotificationType.REMINDER)
                    .title("Nhắc nhở: Workshop sắp diễn ra")
                    .body("Workshop \"AI trong Giáo dục\" sẽ diễn ra vào ngày mai lúc 09:00 tại phòng B4-301.")
                    .read(true)
                    .build());
        }

        if (organizer != null) {
            notificationRepository.save(Notification.builder()
                    .user(organizer)
                    .type(Notification.NotificationType.REGISTRATION_CONFIRMED)
                    .title("Có sinh viên mới đăng ký")
                    .body("3 sinh viên đã đăng ký workshop \"Kỹ năng Phỏng vấn Việc làm IT 2026\". Tổng đăng ký: 35/80.")
                    .read(false)
                    .build());

            notificationRepository.save(Notification.builder()
                    .user(organizer)
                    .type(Notification.NotificationType.CHECKIN_SUCCESS)
                    .title("Đã check-in 1 sinh viên")
                    .body("Hoàng Đình Nam đã check-in thành công tại workshop \"UX Design\".")
                    .read(true)
                    .build());
        }

        log.info("Seeded {} notifications", notificationRepository.count());
    }
}
