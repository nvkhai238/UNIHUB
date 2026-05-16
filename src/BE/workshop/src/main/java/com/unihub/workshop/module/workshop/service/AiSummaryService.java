package com.unihub.workshop.module.workshop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiSummaryService {

    private static final int MAX_GEMINI_INPUT_CHARS = 30_000;
    private static final int MAX_SUMMARY_CHARS = 800;
    private static final int GEMINI_MAX_ATTEMPTS = 3;

    private final WorkshopRepository workshopRepository;
    private final RestTemplate pdfRestTemplate = createRestTemplate(Duration.ofSeconds(10), Duration.ofSeconds(30));
    private final RestTemplate geminiRestTemplate = createRestTemplate(Duration.ofSeconds(5), Duration.ofSeconds(10));
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.gemini.url}")
    private String geminiUrl;

    @Value("${app.gemini.api-key}")
    private String geminiApiKey;

    @Async("aiSummaryTaskExecutor")
    public void processAsync(UUID workshopId, String pdfUrl) {
        try {
            String extractedText = extractTextFromPdf(pdfUrl);
            String summary = generateSummaryWithGemini(extractedText);

            updateSummaryState(workshopId, pdfUrl, summary, "DONE");
            log.info("AI summary completed for workshop {}", workshopId);
        } catch (Exception e) {
            log.warn("AI summary failed for workshop {}", workshopId, e);
            updateSummaryState(workshopId, pdfUrl, null, "FAILED");
        }
    }

    private String extractTextFromPdf(String pdfUrl) throws Exception {
        byte[] pdfBytes = pdfRestTemplate.getForObject(pdfUrl, byte[].class);
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalStateException("Downloaded PDF is empty");
        }

        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String cleaned = cleanAndLimitText(stripper.getText(document));
            if (!StringUtils.hasText(cleaned)) {
                throw new IllegalStateException("No readable text found in PDF");
            }
            return cleaned;
        }
    }

    private String generateSummaryWithGemini(String text) throws Exception {
        if (!StringUtils.hasText(geminiUrl) || !StringUtils.hasText(geminiApiKey)) {
            throw new IllegalStateException("Gemini API is not configured");
        }

        Exception lastException = null;
        for (int attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
            try {
                return requestGeminiSummary(text);
            } catch (Exception e) {
                lastException = e;
                if (attempt == GEMINI_MAX_ATTEMPTS || !isRetryableGeminiError(e)) {
                    throw e;
                }
                sleepBeforeRetry(attempt);
            }
        }
        throw lastException;
    }

    private String requestGeminiSummary(String text) throws Exception {
        String endpoint = geminiUrl + "?key=" + geminiApiKey;
        String prompt = """
                Bạn là trợ lý tóm tắt tài liệu. Nhiệm vụ của bạn là đọc nội dung workshop và viết một đoạn tóm tắt ngắn gọn bằng tiếng Việt.

                Quy tắc bắt buộc:
                - Chỉ viết nội dung tóm tắt, KHÔNG thêm bất kỳ lời mở đầu nào (không được bắt đầu bằng "Dưới đây", "Sau đây", "Bản tóm tắt", v.v.)
                - Viết 3 đến 5 câu liên tiếp, tập trung vào kiến thức và kỹ năng người tham dự sẽ học được
                - Không dùng gạch đầu dòng, không đánh số, không tiêu đề

                Nội dung workshop:
                %s
                """.formatted(text);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                )
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        String response = geminiRestTemplate.postForObject(endpoint, entity, String.class);
        if (!StringUtils.hasText(response)) {
            throw new IllegalStateException("Gemini response is empty");
        }

        JsonNode rootNode = objectMapper.readTree(response);
        JsonNode textNode = rootNode.at("/candidates/0/content/parts/0/text");
        if (textNode.isMissingNode() || !StringUtils.hasText(textNode.asText())) {
            throw new IllegalStateException("Gemini response does not contain summary text");
        }

        String rawSummary = textNode.asText().trim();
        // Strip any leading meta-sentences the model may still produce despite the instruction
        String cleaned = stripPreamble(rawSummary);
        return truncate(cleaned, MAX_SUMMARY_CHARS);
    }

    private void updateSummaryState(UUID workshopId, String pdfUrl, String summary, String status) {
        Workshop workshop = workshopRepository.findById(workshopId).orElse(null);
        if (workshop == null) {
            return;
        }
        if (!pdfUrl.equals(workshop.getPdfUrl())) {
            log.info("Skip stale AI summary result for workshop {}", workshopId);
            return;
        }
        if (summary != null) {
            workshop.setAiSummary(summary);
        }
        workshop.setAiSummaryStatus(status);
        workshopRepository.save(workshop);
    }

    private String cleanAndLimitText(String text) {
        String cleaned = text == null ? "" : text
                .replace('\u0000', ' ')
                .replaceAll("(?m)^\\s*(Trang|Page)?\\s*\\d+\\s*(/\\s*\\d+)?\\s*$", " ")
                .replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return truncate(cleaned, MAX_GEMINI_INPUT_CHARS);
    }

    private String truncate(String value, int maxChars) {
        if (value.length() <= maxChars) {
            return value;
        }
        return value.substring(0, maxChars).trim();
    }

    /**
     * Strips common AI preamble sentences that models sometimes produce despite instructions.
     * Examples: "Dưới đây là bản tóm tắt:", "Sau đây là tóm tắt 4 câu:", etc.
     */
    private String stripPreamble(String text) {
        if (!StringUtils.hasText(text)) {
            return text;
        }
        // Match a leading sentence that is clearly a meta-comment (not actual content).
        // Patterns: lines ending with ':' that contain preamble keywords.
        String[] preamblePatterns = {
            "(?si)^(dưới đây[^\\n]*:|sau đây[^\\n]*:|bản tóm tắt[^\\n]*:|tóm tắt[^\\n]*:)\\s*",
            "(?si)^(here is[^\\n]*:|the following[^\\n]*:)\\s*"
        };
        String result = text;
        for (String pattern : preamblePatterns) {
            result = result.replaceFirst(pattern, "");
        }
        return result.trim();
    }

    private boolean isRetryableGeminiError(Exception e) {
        if (e instanceof ResourceAccessException) {
            return true;
        }
        if (e instanceof HttpStatusCodeException httpException) {
            int status = httpException.getStatusCode().value();
            return status == 429 || status >= 500;
        }
        return false;
    }

    private void sleepBeforeRetry(int attempt) {
        try {
            Thread.sleep(Duration.ofSeconds(attempt).toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private RestTemplate createRestTemplate(Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return new RestTemplate(requestFactory);
    }
}
