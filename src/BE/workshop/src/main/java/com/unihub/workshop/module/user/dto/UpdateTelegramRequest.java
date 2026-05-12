package com.unihub.workshop.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateTelegramRequest {
    @NotBlank(message = "Telegram ID không được để trống")
    private String telegramId;
}
