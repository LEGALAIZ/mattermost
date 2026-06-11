// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties';

export type SessionAttributeField = UserPropertyField;

export const SESSION_ATTRIBUTES_TARGET_TYPE = 'system';

export type SessionAttributeDisplayType = 'String' | 'IP' | 'Boolean' | 'Version' | 'Enum';

export const SERVER_SOURCED_NAMES = ['ip_address', 'user_agent'] as const;

export const DURATION_PRESETS_SECONDS = [30, 60, 300, 3600, 86400] as const;

const DURATION_PRESET_LABELS: Record<number, string> = {
    30: '30s',
    60: '1m',
    300: '5m',
    3600: '1h',
    86400: '24h',
};

// Precedence: select options decide Boolean vs Enum; text names map to IP/Version; everything else is String.
export function getDisplayType(field: SessionAttributeField): SessionAttributeDisplayType {
    const name = field.name.toLowerCase();

    if (field.type === 'select') {
        const optionNames = field.attrs.options?.map((option) => option.name.toLowerCase()) ?? [];
        const isBoolean = optionNames.length === 2 && optionNames.includes('true') && optionNames.includes('false');
        return isBoolean ? 'Boolean' : 'Enum';
    }

    if (field.type === 'text') {
        if (name.endsWith('ip_address')) {
            return 'IP';
        }
        if (name.endsWith('_version')) {
            return 'Version';
        }
        return 'String';
    }

    return 'String';
}

export function isServerSourced(name: string): boolean {
    const lower = name.toLowerCase();
    return lower === 'ip_address' || lower.endsWith('ip_address') || lower.startsWith('user_agent');
}

export function formatDuration(seconds: number): string {
    const preset = DURATION_PRESET_LABELS[seconds];
    if (preset) {
        return preset;
    }

    if (seconds < 60) {
        return `${seconds}s`;
    }
    if (seconds < 3600) {
        return `${Math.round(seconds / 60)}m`;
    }
    if (seconds < 86400) {
        return `${Math.round(seconds / 3600)}h`;
    }
    return `${Math.round(seconds / 86400)}d`;
}
