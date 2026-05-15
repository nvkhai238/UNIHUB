package com.unihub.workshop.module.payment.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Builder
public class PagedResponse<T> {
    private List<T> content;
    private int page;
    private int size;
    private int totalPages;
    private long totalElements;
    private boolean first;
    private boolean last;

    public static <T> PagedResponse<T> from(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalPages(page.getTotalPages())
                .totalElements(page.getTotalElements())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }
}
