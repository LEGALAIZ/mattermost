// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {SessionAttributeField} from './utils';
import {
    DURATION_PRESETS_SECONDS,
    formatDuration,
    getDisplayType,
    isServerSourced,
} from './utils';

function makeField(overrides: Partial<SessionAttributeField> = {}): SessionAttributeField {
    return {
        id: 'field-id',
        name: 'attribute',
        type: 'text',
        group_id: SESSION_ATTRIBUTES_GROUP_ID,
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        object_type: 'session',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
        ...overrides,
    };
}

function options(...names: string[]): PropertyFieldOption[] {
    return names.map((name, index) => ({id: `opt-${index}`, name}));
}

describe('session_attributes utils', () => {
    describe('getDisplayType', () => {
        it('maps a select with true/false options to Boolean', () => {
            const field = makeField({type: 'select', attrs: {sort_order: 0, visibility: 'when_set', value_type: '', options: options('true', 'false')}});
            expect(getDisplayType(field)).toBe('Boolean');
        });

        it('maps a select with other options to Enum', () => {
            const field = makeField({type: 'select', attrs: {sort_order: 0, visibility: 'when_set', value_type: '', options: options('wifi', 'vpn')}});
            expect(getDisplayType(field)).toBe('Enum');
        });

        it('maps a select with no options to Enum', () => {
            const field = makeField({type: 'select'});
            expect(getDisplayType(field)).toBe('Enum');
        });

        it('maps a text field ending in ip_address to IP', () => {
            expect(getDisplayType(makeField({type: 'text', name: 'ip_address'}))).toBe('IP');
            expect(getDisplayType(makeField({type: 'text', name: 'source_ip_address'}))).toBe('IP');
        });

        it('maps a text field ending in _version to Version', () => {
            expect(getDisplayType(makeField({type: 'text', name: 'app_version'}))).toBe('Version');
            expect(getDisplayType(makeField({type: 'text', name: 'os_version'}))).toBe('Version');
        });

        it('maps other text fields to String', () => {
            expect(getDisplayType(makeField({type: 'text', name: 'user_agent'}))).toBe('String');
            expect(getDisplayType(makeField({type: 'text', name: 'device_model'}))).toBe('String');
        });

        it('maps non-text, non-select field types to String', () => {
            expect(getDisplayType(makeField({type: 'date', name: 'last_seen'}))).toBe('String');
        });
    });

    describe('isServerSourced', () => {
        it('is true for server-sourced names', () => {
            expect(isServerSourced('ip_address')).toBe(true);
            expect(isServerSourced('source_ip_address')).toBe(true);
            expect(isServerSourced('user_agent')).toBe(true);
            expect(isServerSourced('user_agent_browser')).toBe(true);
        });

        it('is false for client-sourced names', () => {
            expect(isServerSourced('network_status')).toBe(false);
            expect(isServerSourced('client_type')).toBe(false);
        });

        it('does not over-match names that merely contain the source tokens', () => {
            expect(isServerSourced('client_user_agent')).toBe(false);
            expect(isServerSourced('ip_address_country')).toBe(false);
        });
    });

    describe('formatDuration', () => {
        it('renders the exact preset labels', () => {
            expect(formatDuration(30)).toBe('30s');
            expect(formatDuration(60)).toBe('1m');
            expect(formatDuration(300)).toBe('5m');
            expect(formatDuration(3600)).toBe('1h');
            expect(formatDuration(86400)).toBe('24h');
        });

        it('renders non-preset values via the fallback', () => {
            expect(formatDuration(45)).toBe('45s');
            expect(formatDuration(90)).toBe('2m');
            expect(formatDuration(7200)).toBe('2h');
            expect(formatDuration(172800)).toBe('2d');
        });
    });

    describe('DURATION_PRESETS_SECONDS', () => {
        it('exposes the supported preset values', () => {
            expect([...DURATION_PRESETS_SECONDS]).toEqual([30, 60, 300, 3600, 86400]);
        });
    });
});
