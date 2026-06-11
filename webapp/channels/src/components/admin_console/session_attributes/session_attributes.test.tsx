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

const baseField: UserPropertyField = {
    id: 'session-field',
    name: 'ip_address',
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
};

const sessionFields: UserPropertyField[] = [
    {...baseField, id: 'session-field-0', name: 'ip_address'},
    {...baseField, id: 'session-field-1', name: 'network_status'},
];

function getBaseState(seededFields: UserPropertyField[] = []): DeepPartial<GlobalState> {
    const currentUser = TestHelper.getUserMock();

    const byId: Record<string, UserPropertyField> = {};
    seededFields.forEach((field) => {
        byId[field.id] = field;
    });

    return {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
            general: {

            },
            properties: {
                fields: {
                    byId,
                    byObjectType: {
                        session: {
                            session_attributes: byId,
                        },
                    },
                },
            },
        },
    };
}

describe('SessionAttributesPage', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
        getPropertyFields.mockResolvedValueOnce(sessionFields).mockResolvedValue([]);
    });

    it('renders the configure intro on mount', async () => {
        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByRole('heading', {name: 'Configure session attributes'})).toBeInTheDocument();
        expect(screen.getByText('Session attributes are evaluated per session and can be used in access control policies.')).toBeInTheDocument();
        expect(screen.getByTestId('session_attributes_table_placeholder')).toBeInTheDocument();
    });

    it('fetches the session attribute fields once on mount', async () => {
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

    it('resolves the seeded fields through the selector', async () => {
        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState(sessionFields));

        const placeholder = await screen.findByTestId('session_attributes_table_placeholder');
        expect(placeholder).toHaveAttribute('data-count', String(sessionFields.length));
    });

    it('respects the disabled prop and renders no config toggles', async () => {
        renderWithContext(<SessionAttributesPage disabled={true}/>, getBaseState());

        const placeholder = await screen.findByTestId('session_attributes_table_placeholder');
        expect(placeholder).toHaveAttribute('aria-disabled', 'true');

        expect(screen.queryByText('Trust proxy device identity header')).not.toBeInTheDocument();
        expect(screen.queryByText('Enforce device ID consistency')).not.toBeInTheDocument();
    });
});
