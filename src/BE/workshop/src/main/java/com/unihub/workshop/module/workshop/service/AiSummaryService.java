package com.unihub.workshop.module.workshop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.net.URL;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiSummaryService {

    private final WorkshopRepository workshopRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.gemini.url}")
    private String geminiUrl;

    @Value("${app.gemini.api-key}")
    private String geminiApiKey;

    @Async
    public void processAsync(UUID workshopId, String pdfUrl) {
        Workshop workshop = workshopRepository.findById(workshopId).orElse(null);
        if (workshop == null) return;

        try {
            String extractedText = extractTextFromPdf(pdfUrl);
            String summary = generateSummaryWithGemini(extractedText);

            workshop.setAiSummary(summary);
            workshop.setAiSummaryStatus("DONE");
        } catch (Exception e) {
            workshop.setAiSummaryStatus("FAILED");
        }
        workshopRepository.save(workshop);
    }

    private String extractTextFromPdf(String pdfUrl) throws Exception {
        try (InputStream in = new URL(pdfUrl).openStream();
             PDDocument document = Loader.loadPDF(in.readAllBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String generateSummaryWithGemini(String text) throws Exception {
        String endpoint = geminiUrl + "?key=" + geminiApiKey;
        String prompt = "Hãy tóm tắt nội dung workshop sau trong 3-5 câu bằng tiếng Việt...\n\n" + text;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = Map.of(
            "contents", new Object[]{
                Map.of("parts", new Object[]{
                    Map.of("text", prompt)
                })
            }
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        String response = restTemplate.postForObject(endpoint, entity, String.class);

        JsonNode rootNode = objectMapper.readTree(response);
        return rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
    }
}
