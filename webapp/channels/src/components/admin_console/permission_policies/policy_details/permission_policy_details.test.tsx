// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import TableEditor from '../../access_control/editors/table_editor/table_editor';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn()}),
}));

jest.mock('../../access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

jest.mock('../../access_control/editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;
const MockedCELEditor = CELEditor as jest.MockedFunction<typeof CELEditor>;

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails', () => {
    const mockGetAccessControlFields = jest.fn();

    const baseProps = {
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: false,
            TrustProxyDeviceIdentityHeader: false,
            EnforceDeviceIDConsistency: false,
        },
        sessionAttributesEnabled: true,
        actions: {
            fetchPolicy: jest.fn().mockResolvedValue({data: {}}),
            createPolicy: jest.fn().mockResolvedValue({data: {}}),
            deletePolicy: jest.fn().mockResolvedValue({data: {}}),
            setNavigationBlocked: jest.fn(),
        },
    };

    beforeEach(() => {
        mockGetAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'department', group_id: 'custom_profile_attributes', attrs: {managed: 'admin'}},
                {id: 's1', name: 'network_name', group_id: SESSION_ATTRIBUTES_GROUP_ID, attrs: {}},
            ],
        });
        mockUseChannelAccessControlActions.mockReturnValue({
            getAccessControlFields: mockGetAccessControlFields,
            getVisualAST: jest.fn().mockResolvedValue({data: {}}),
            searchUsers: jest.fn(),
            getChannelPolicy: jest.fn(),
            saveChannelPolicy: jest.fn(),
            deleteChannelPolicy: jest.fn(),
            getChannelMembers: jest.fn(),
            createJob: jest.fn(),
            createAccessControlSyncJob: jest.fn(),
            validateExpressionAgainstRequester: jest.fn(),
            simulatePolicyForUsers: jest.fn(),
            updateAccessControlPoliciesActive: jest.fn(),
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('includes session attributes in the table-mode picker', async () => {
        renderWithContext(<PermissionPolicyDetails {...baseProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const passedNames = lastCall.userAttributes.map((attr) => attr.name);
        expect(passedNames).toContain('department');
        expect(passedNames).toContain('network_name');
    });

    test('includes session attributes in CEL mode even when user-managed attributes are disabled', async () => {
        renderWithContext(<PermissionPolicyDetails {...baseProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Switch to Advanced Mode'));

        await waitFor(() => {
            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
        });

        const lastCall = MockedCELEditor.mock.calls[MockedCELEditor.mock.calls.length - 1][0];
        const passedAttributes = lastCall.userAttributes.map((attr) => attr.attribute);
        expect(passedAttributes).toContain('network_name');
    });
});
