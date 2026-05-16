package com.unihub.workshop.module.workshop.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SupabaseStorageService {

    @Value("${app.supabase.url}")
    private String supabaseUrl;

    @Value("${app.supabase.service-role-key}")
    private String supabaseKey;

    @Value("${app.supabase.bucket}")
    private String bucket;

    private final RestTemplate restTemplate;

    public SupabaseStorageService() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public String uploadPdf(UUID workshopId, MultipartFile file) {
        return upload(workshopId, file, "pdf", MediaType.APPLICATION_PDF, ".pdf");
    }

    public String uploadImage(UUID workshopId, MultipartFile file) {
        String contentType = file.getContentType();
        MediaType mediaType = contentType != null ? MediaType.parseMediaType(contentType) : MediaType.IMAGE_PNG;
        return upload(workshopId, file, "images", mediaType, "");
    }

    private String upload(UUID workshopId, MultipartFile file, String folder, MediaType mediaType, String extension) {
        if (!StringUtils.hasText(supabaseUrl) || !StringUtils.hasText(supabaseKey)) {
            throw new AppException(ErrorCode.STORAGE_ERROR, "Supabase storage is not configured");
        }

        String filename = sanitizeFilename(file.getOriginalFilename(), extension);
        // Structure: {folder}/{workshopId}/{timestamp}_{filename}
        // Each workshop gets its own subdirectory to keep storage clean
        String objectPath = "%s/%s/%d_%s".formatted(
                folder,
                workshopId,
                System.currentTimeMillis(),
                filename
        );
        String endpoint = trimTrailingSlash(supabaseUrl)
                + "/storage/v1/object/"
                + bucket   // bucket name does not need URI encoding
                + "/"
                + encodeObjectPath(objectPath);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(supabaseKey);
            headers.setContentType(mediaType);
            headers.set("x-upsert", "true");

            HttpEntity<byte[]> requestEntity = new HttpEntity<>(file.getBytes(), headers);
            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new AppException(ErrorCode.STORAGE_ERROR, "Failed to upload file to Supabase");
            }

            return trimTrailingSlash(supabaseUrl)
                    + "/storage/v1/object/public/"
                    + bucket
                    + "/"
                    + encodeObjectPath(objectPath);
        } catch (HttpStatusCodeException e) {
            log.warn("Supabase upload failed with status {} and body {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AppException(ErrorCode.STORAGE_ERROR, "Failed to upload file to Supabase");
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Supabase upload failed", e);
            throw new AppException(ErrorCode.STORAGE_ERROR, "Failed to upload file to Supabase");
        }
    }

    private String sanitizeFilename(String originalFilename, String extension) {
        String fallback = "file" + extension;
        if (!StringUtils.hasText(originalFilename)) {
            return fallback;
        }
        String normalized = originalFilename.replace('\\', '/');
        String cleaned = normalized.substring(normalized.lastIndexOf('/') + 1)
                .replaceAll("[^A-Za-z0-9._-]", "_");
        if (!StringUtils.hasText(cleaned)) {
            return fallback;
        }
        if (StringUtils.hasText(extension) && !cleaned.toLowerCase().endsWith(extension)) {
            return cleaned + extension;
        }
        return cleaned.toLowerCase();
    }

    private String encodeObjectPath(String objectPath) {
        return Arrays.stream(objectPath.split("/"))
                .map(segment -> UriUtils.encodePathSegment(segment, StandardCharsets.UTF_8))
                .collect(Collectors.joining("/"));
    }

    private String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
