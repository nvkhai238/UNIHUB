package com.unihub.workshop.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdatePhoneRequest {
    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^(\\+[1-9]\\d{7,14}|0\\d{9,10}|84\\d{8,13})$", message = "Số điện thoại không hợp lệ")
    private String phone;
}
