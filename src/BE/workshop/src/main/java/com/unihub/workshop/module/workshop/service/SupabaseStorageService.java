package com.unihub.workshop.module.workshop.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
public class SupabaseStorageService {

    @Value("${app.supabase.url}")
    private String supabaseUrl;

    @Value("${app.supabase.service-role-key}")
    private String supabaseKey;

    @Value("${app.supabase.bucket}")
    private String bucket;

    private final RestTemplate restTemplate = new RestTemplate();

    public String uploadPdf(UUID workshopId, MultipartFile file) {
        try {
            String filename = workshopId.toString() + "_" + System.currentTimeMillis() + ".pdf";
            String endpoint = supabaseUrl + "/storage/v1/object/" + bucket + "/" + filename;

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(supabaseKey);
            headers.setContentType(MediaType.APPLICATION_PDF);

            HttpEntity<byte[]> requestEntity = new HttpEntity<>(file.getBytes(), headers);
            restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity, String.class);

            return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + filename;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to upload file to Supabase");
        }
    }
}
