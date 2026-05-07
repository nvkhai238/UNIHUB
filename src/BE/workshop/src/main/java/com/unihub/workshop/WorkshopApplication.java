package com.unihub.workshop;

import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.crypto.password.PasswordEncoder;

import jakarta.annotation.PostConstruct;

import java.util.TimeZone;

@SpringBootApplication
@EnableAsync
public class WorkshopApplication {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

	public static void main(String[] args) {
		SpringApplication.run(WorkshopApplication.class, args);
	}
	
	@PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));

        if (!userRepository.existsByEmail("admin@unihub.edu.vn")) {
            User admin = new User();
            admin.setEmail("admin@unihub.edu.vn");
            admin.setFullName("Admin UniHub");
            admin.setRole(UserRole.ORGANIZER);
            admin.setIsActive(true);
            admin.setPassword(passwordEncoder.encode("123456")); 
            userRepository.save(admin);
        }
    }
}
