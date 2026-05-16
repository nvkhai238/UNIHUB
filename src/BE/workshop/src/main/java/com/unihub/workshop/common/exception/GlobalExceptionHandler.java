package com.unihub.workshop.common.exception;

import com.unihub.workshop.common.response.ApiResponse;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DuplicateFieldException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleDuplicateField(DuplicateFieldException ex) {
        ErrorCode code = ex.getErrorCode();
        Map<String, String> detail = new HashMap<>();
        detail.put("field", ex.getField());
        ApiResponse<Map<String, String>> response = ApiResponse.<Map<String, String>>builder()
                .status(code.getStatus())
                .code(code.getCode())
                .message(ex.getMessage())
                .data(detail)
                .build();
        return ResponseEntity.status(code.getHttpStatus()).body(response);
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        ErrorCode code = ex.getErrorCode();
        return ResponseEntity
                .status(code.getHttpStatus())
                .body(ApiResponse.error(code.getStatus(), code.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleEntityNotFound(EntityNotFoundException ex) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(404, "NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Map<String, String>>builder()
                        .status(400)
                        .code("VALIDATION_FAILED")
                        .message("Request validation failed")
                        .data(errors)
                    .build());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity
                .status(ErrorCode.INVALID_FILE.getHttpStatus())
                .body(ApiResponse.error(
                        ErrorCode.INVALID_FILE.getStatus(),
                        ErrorCode.INVALID_FILE.getCode(),
                        "PDF file must be 10MB or smaller"
                ));
    }

    @ExceptionHandler(RequestNotPermitted.class)
    public ResponseEntity<ApiResponse<Void>> handleRateLimit(RequestNotPermitted ex) {
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "10")
                .body(ApiResponse.error(
                        429,
                        "RATE_LIMIT_EXCEEDED",
                        "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."
                ));
    }

    @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(Exception ex) {
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(403, "FORBIDDEN", "Access denied"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        ex.printStackTrace();
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred"));
    }
}
