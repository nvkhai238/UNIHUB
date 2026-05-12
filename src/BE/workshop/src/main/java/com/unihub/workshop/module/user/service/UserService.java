package com.unihub.workshop.module.user.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public void updatePhone(String email, String phone) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
                
        user.setPhone(phone);
        userRepository.save(user);
    }

    @Transactional
    public void updateTelegramId(String email, String telegramId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
                
        user.setTelegramId(telegramId);
        userRepository.save(user);
    }
}
