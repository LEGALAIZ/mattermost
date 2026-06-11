// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import SessionAttributesPage from './session_attributes';

type ExtraAttrs = {
    options?: Array<{name: string}>;
    display_name?: string;
    enabled?: boolean;
    platforms?: string[];
    ttl_seconds?: number;
    grace_period_seconds?: number;
};

function makeField(name: string, type: 'text' | 'select', sortOrder: number, extra: ExtraAttrs = {}): UserPropertyField {
    const {options, ...tunables} = extra;

    return {
        id: `session-${name}`,
        name,
        type,
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
            sort_order: sortOrder,
            visibility: 'when_set',
            value_type: '',
            ...(options ? {options} : {}),
            ...tunables,
        },
    } as UserPropertyField;
}

const representativeFields: UserPropertyField[] = [
    makeField('ip_address', 'text', 0, {
        display_name: 'Client IP',
        platforms: ['desktop', 'browser'],
        ttl_seconds: 300,
        grace_period_seconds: 60,
        enabled: true,
    }),
    makeField('vpn_active', 'select', 1, {
        options: [{name: 'true'}, {name: 'false'}],
        platforms: ['desktop'],
        enabled: false,
    }),
];

function getBaseState(): DeepPartial<GlobalState> {
    const currentUser = TestHelper.getUserMock();

    return {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
            general: {},
            properties: {
                fields: {
                    byId: {},
                    byObjectType: {},
                },
            },
        },
    };
}

describe('SessionAttributesPage', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
    });

    it('fetches the session attribute fields once on mount', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        await waitFor(() => {
            expect(getPropertyFields).toHaveBeenCalled();
        });

        expect(getPropertyFields.mock.calls[0].slice(0, 4)).toEqual([
            SESSION_ATTRIBUTES_GROUP_ID,
            'session',
            'system',
            undefined,
        ]);

        const initialFetches = getPropertyFields.mock.calls.filter((call) => call[4]?.cursorId === undefined);
        expect(initialFetches).toHaveLength(1);
    });

    it('shows the loading state before fields resolve', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(screen.getByText('Loading')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });
    });

    it('renders the table fed by the fetched fields', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByText('Client IP')).toBeInTheDocument();

        const typeLabels = screen.getAllByTestId('session-attribute-type').map((cell) => cell.textContent);
        expect(typeLabels).toContain('IP');
        expect(typeLabels).toContain('Boolean');

        const statuses = screen.getAllByTestId('session-attribute-status').map((cell) => cell.textContent);
        expect(statuses).toContain('Enabled');
        expect(statuses).toContain('Disabled');

        expect(screen.getAllByTestId('session-attribute-platforms').length).toBe(representativeFields.length);
    });

    it('shows the empty state when there are no fields', async () => {
        getPropertyFields.mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByText('No session attributes found.')).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: 'Display Name'})).not.toBeInTheDocument();
    });

    it('renders the configure intro on mount', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByRole('heading', {name: 'Configure session attributes'})).toBeInTheDocument();
        expect(screen.getByText('Session attributes are evaluated per session and can be used in access control policies.')).toBeInTheDocument();
    });

    it('marks the table region advisory-disabled when the page is disabled', async () => {
        getPropertyFields.mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={true}/>, getBaseState());

        const empty = await screen.findByText('No session attributes found.');
        expect(empty.closest('[aria-disabled="true"]')).toBeInTheDocument();
    });
});
