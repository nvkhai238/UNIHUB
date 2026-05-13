package com.unihub.workshop.module.user.util;

public final class PhoneNumberUtils {

    private PhoneNumberUtils() {
    }

    public static String normalizeToE164(String rawPhone) {
        if (rawPhone == null) {
            throw new IllegalArgumentException("Phone number is required");
        }

        String sanitized = rawPhone.trim()
                .replace(" ", "")
                .replace("-", "")
                .replace("(", "")
                .replace(")", "");

        if (sanitized.isEmpty()) {
            throw new IllegalArgumentException("Phone number is required");
        }

        if (sanitized.startsWith("00")) {
            sanitized = "+" + sanitized.substring(2);
        }

        if (sanitized.startsWith("+")) {
            validateE164(sanitized);
            return sanitized;
        }

        if (sanitized.startsWith("84") && sanitized.length() >= 10) {
            sanitized = "+" + sanitized;
            validateE164(sanitized);
            return sanitized;
        }

        if (sanitized.startsWith("0") && sanitized.length() >= 10 && sanitized.length() <= 11) {
            sanitized = "+84" + sanitized.substring(1);
            validateE164(sanitized);
            return sanitized;
        }

        throw new IllegalArgumentException("Phone number format is invalid");
    }

    private static void validateE164(String phone) {
        if (!phone.matches("^\\+[1-9]\\d{7,14}$")) {
            throw new IllegalArgumentException("Phone number format is invalid");
        }
    }
}
