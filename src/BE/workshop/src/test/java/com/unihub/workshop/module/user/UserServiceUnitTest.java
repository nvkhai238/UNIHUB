package com.unihub.workshop.module.user;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class UserServiceUnitTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void updatePhone_NormalizesVietnamNumberBeforeSaving() {
        User user = User.builder()
                .email("student@test.edu.vn")
                .phone("0396177323")
                .build();

        when(userRepository.findByEmail("student@test.edu.vn")).thenReturn(Optional.of(user));

        userService.updatePhone("student@test.edu.vn", "0396177323");

        assertThat(user.getPhone()).isEqualTo("+84396177323");
        verify(userRepository).save(user);
    }

    @Test
    void updatePhone_ThrowsForInvalidNumber() {
        User user = User.builder()
                .email("student@test.edu.vn")
                .build();

        when(userRepository.findByEmail("student@test.edu.vn")).thenReturn(Optional.of(user));

        assertThrows(AppException.class, () -> userService.updatePhone("student@test.edu.vn", "abc"));
    }
}
