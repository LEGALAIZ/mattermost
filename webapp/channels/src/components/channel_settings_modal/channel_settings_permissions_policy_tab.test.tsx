// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPermissionsPolicyTab from './channel_settings_permissions_policy_tab';

jest.mock('hooks/useChannelAccessControlActions');
jest.mock('hooks/useChannelSystemPolicies');
jest.mock('hooks/useEnabledSessionAttributeFields', () => ({
    useEnabledSessionAttributeFields: jest.fn(() => []),
}));

jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseChannelSystemPolicies = useChannelSystemPolicies as jest.MockedFunction<typeof useChannelSystemPolicies>;
const mockUseEnabledSessionAttributeFields = useEnabledSessionAttributeFields as jest.MockedFunction<typeof useEnabledSessionAttributeFields>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;

const SESSION_GROUP_UUID = 'nkpkzni6yjrjt8uktpbwkagoth';

const makeSessionField = (id: string, name: string): UserPropertyField => ({
    id,
    name,
    type: 'text',
    group_id: SESSION_GROUP_UUID,
    target_id: '',
    target_type: 'system',
    object_type: 'session',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        enabled: true,
    } as UserPropertyField['attrs'],
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('components/channel_settings_modal/ChannelSettingsPermissionsPolicyTab', () => {
    const mockActions = {
        getAccessControlFields: jest.fn(),
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
        getChannelPolicy: jest.fn(),
        saveChannelPolicy: jest.fn(),
        deleteChannelPolicy: jest.fn(),
        getChannelMembers: jest.fn(),
        createJob: jest.fn(),
        createAccessControlSyncJob: jest.fn(),
        updateAccessControlPoliciesActive: jest.fn(),
        validateExpressionAgainstRequester: jest.fn(),
        simulatePolicyForUsers: jest.fn(),
    };

    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        }),
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'testuser',
                        roles: 'system_admin',
                    },
                },
            },
            roles: {
                roles: {},
            },
            channels: {
                channels: {},
            },
            teams: {
                currentTeamId: 'team_id',
            },
        },
    };

    beforeEach(() => {
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        mockUseChannelSystemPolicies.mockReturnValue({
            policies: [],
            loading: false,
            error: null,
        });
        mockActions.getChannelPolicy.mockResolvedValue({error: {status_code: 404}});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('merges the fetched enabled session attributes into the rule editor picker', async () => {
        mockActions.getAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'department', group_id: 'cpa9q4w7m2x5c8v1b6n3k0jr5h', object_type: 'user', attrs: {managed: 'admin'}},
            ],
        });
        mockUseEnabledSessionAttributeFields.mockReturnValue([makeSessionField('s1', 'network_name')]);

        renderWithContext(
            <ChannelSettingsPermissionsPolicyTab {...baseProps}/>,
            initialState,
        );

        const addRuleButton = await screen.findByTestId('permissions-policy-add-rule');
        await waitFor(() => {
            expect(addRuleButton).not.toBeDisabled();
        });

        await userEvent.click(addRuleButton);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const passedNames = lastCall.userAttributes.map((attr) => attr.name);
        expect(passedNames).toContain('department');
        expect(passedNames).toContain('network_name');
    });

    test('shows no session attributes when none are enabled', async () => {
        mockActions.getAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'department', group_id: 'cpa9q4w7m2x5c8v1b6n3k0jr5h', object_type: 'user', attrs: {managed: 'admin'}},
            ],
        });
        mockUseEnabledSessionAttributeFields.mockReturnValue([]);

        renderWithContext(
            <ChannelSettingsPermissionsPolicyTab {...baseProps}/>,
            initialState,
        );

        const addRuleButton = await screen.findByTestId('permissions-policy-add-rule');
        await waitFor(() => {
            expect(addRuleButton).not.toBeDisabled();
        });

        await userEvent.click(addRuleButton);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const passedNames = lastCall.userAttributes.map((attr) => attr.name);
        expect(passedNames).toEqual(['department']);
    });
});
