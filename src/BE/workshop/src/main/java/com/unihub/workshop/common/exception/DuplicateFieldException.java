package com.unihub.workshop.common.exception;

import lombok.Getter;

@Getter
public class DuplicateFieldException extends RuntimeException {
    private final ErrorCode errorCode;
    private final String field;

    public DuplicateFieldException(ErrorCode errorCode, String field, String message) {
        super(message);
        this.errorCode = errorCode;
        this.field = field;
    }
}
