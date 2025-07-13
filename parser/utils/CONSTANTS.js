import chalk from 'chalk';
import { connect } from 'puppeteer-real-browser';

export const CONSTANTS = {
    CHALK: chalk,
    PUPPETEER: {
        connect
    },
    DELAYS: {
        BETWEEN_PAGES: 3000,
        CLOUDFLARE_CHECK: 1000,
        MAX_CLOUDFLARE_WAIT: 30000,
        AFTER_PAGE_LOAD: 5000,
        BETWEEN_RETRIES: 10000
    },
    LIMITS: {
        MAX_PAGES: 10,
        DEFAULT_TEST_LIMIT: 5,
        MAX_RETRIES: 3,
        MAX_ERRORS: 50
    },
    SELECTORS: {
        COMMON: {
            TITLE: 'h1.fontRB, h1, .listing-title',
            DESCRIPTION: '.ql-editor.description-content, .description',
            PRICE: '.price-section .price, .fz24-text.price',
            LOCATION: '.property-location, .detail-info-location',
            IMAGES: 'img[src*="realty"], img[src*="listing"], img[src*="property"]',
            FEATURES: '.features li, .amenities li, .property-features li'
        },
        SPECS: {
            CONTAINER: '.adv-info-list, .property-specs',
            ITEM: '.spec-item',
            LABEL: '.spec-item-label, .label, dt, th, .key',
            VALUE: '.spec-item-value, .value, dd, td, .val'
        }
    },
    CLOUDFLARE: {
        TITLES: ['Challenge', 'Checking', 'Один момент'],
        MAX_ATTEMPTS: 12,
        CHECK_INTERVAL: 5000
    }
}; 