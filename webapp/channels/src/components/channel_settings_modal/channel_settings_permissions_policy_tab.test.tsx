// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPermissionsPolicyTab from './channel_settings_permissions_policy_tab';

jest.mock('hooks/useChannelAccessControlActions');
jest.mock('hooks/useChannelSystemPolicies');

jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseChannelSystemPolicies = useChannelSystemPolicies as jest.MockedFunction<typeof useChannelSystemPolicies>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;

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

    test('passes session attributes through to the rule editor picker', async () => {
        mockActions.getAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'department', group_id: 'custom_profile_attributes', attrs: {managed: 'admin'}},
                {id: 's1', name: 'network_name', group_id: SESSION_ATTRIBUTES_GROUP_ID, attrs: {}},
            ],
        });

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
});
