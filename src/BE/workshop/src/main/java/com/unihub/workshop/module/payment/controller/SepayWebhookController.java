package com.unihub.workshop.module.payment.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.payment.dto.SepayWebhookRequest;
import com.unihub.workshop.module.payment.service.PaymentProcessorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Slf4j
public class SepayWebhookController {

    private final PaymentProcessorService paymentProcessorService;

    @PostMapping("/sepay")
    public ResponseEntity<ApiResponse<String>> handleSepayWebhook(@RequestBody SepayWebhookRequest request) {
        log.info("Received Sepay Webhook: {}", request);

        if (request.getTransferType() != null && request.getTransferType().equalsIgnoreCase("in")) {
            String content = request.getContent();
            if (content != null) {
                // Extract payment code (e.g. UH123456)
                Pattern pattern = Pattern.compile("(UH\\d{6})", Pattern.CASE_INSENSITIVE);
                Matcher matcher = pattern.matcher(content);
                if (matcher.find()) {
                    String paymentCode = matcher.group(1).toUpperCase();
                    paymentProcessorService.processSepayWebhook(paymentCode, request.getTransferAmount());
                } else {
                    log.warn("No valid payment code found in sepay content: {}", content);
                }
            }
        }

        return ResponseEntity.ok(ApiResponse.success("Webhook processed"));
    }
}
