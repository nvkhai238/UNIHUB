package com.unihub.workshop.module.user;

import com.unihub.workshop.module.user.util.PhoneNumberUtils;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class PhoneNumberUtilsTest {

    @Test
    void normalizeToE164_ConvertsVietnamLocalNumber() {
        assertThat(PhoneNumberUtils.normalizeToE164("0396177323"))
                .isEqualTo("+84396177323");
    }

    @Test
    void normalizeToE164_KeepsInternationalNumber() {
        assertThat(PhoneNumberUtils.normalizeToE164("+84396177323"))
                .isEqualTo("+84396177323");
    }

    @Test
    void normalizeToE164_RejectsInvalidNumber() {
        assertThrows(IllegalArgumentException.class, () -> PhoneNumberUtils.normalizeToE164("abc"));
    }
}
