package com.unihub.workshop.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangePasswordRequest {

    @NotBlank
    private String currentPassword;

    @NotBlank
    @Size(min = 8, max = 255)
    private String newPassword;
}
