package com.unihub.workshop.module.workshop.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PdfUploadResponse {
    private String pdfUrl;
    private String aiSummaryStatus;
}
