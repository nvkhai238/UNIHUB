package com.unihub.workshop.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    INTERNAL_SERVER_ERROR(500, "INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR),
    UNAUTHORIZED(401, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(403, "FORBIDDEN", HttpStatus.FORBIDDEN),
    NOT_FOUND(404, "NOT_FOUND", HttpStatus.NOT_FOUND),
    VALIDATION_FAILED(400, "VALIDATION_FAILED", HttpStatus.BAD_REQUEST),
    DUPLICATE_REGISTRATION(409, "DUPLICATE_REGISTRATION", HttpStatus.CONFLICT),
    WORKSHOP_FULL(409, "WORKSHOP_FULL", HttpStatus.CONFLICT),
    INVALID_TOKEN(401, "INVALID_TOKEN", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(401, "TOKEN_EXPIRED", HttpStatus.UNAUTHORIZED),
    USER_NOT_ACTIVE(403, "USER_NOT_ACTIVE", HttpStatus.FORBIDDEN),
    USER_NOT_FOUND(404, "USER_NOT_FOUND", HttpStatus.NOT_FOUND),
    WORKSHOP_NOT_FOUND(404, "WORKSHOP_NOT_FOUND", HttpStatus.NOT_FOUND),
    REGISTRATION_NOT_FOUND(404, "REGISTRATION_NOT_FOUND", HttpStatus.NOT_FOUND),
    PAYMENT_ALREADY_EXISTS(409, "PAYMENT_ALREADY_EXISTS", HttpStatus.CONFLICT),
    PAYMENT_UNAVAILABLE(503, "PAYMENT_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE);

    private final int status;
    private final String code;
    private final HttpStatus httpStatus;

    ErrorCode(int status, String code, HttpStatus httpStatus) {
        this.status = status;
        this.code = code;
        this.httpStatus = httpStatus;
    }
}
