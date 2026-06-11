// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {CheckCircleIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

type Props = {
    enabled: boolean;
};

export default function StatusChip({enabled}: Props) {
    return (
        <Chip
            $enabled={enabled}
            data-testid='session-attribute-status'
            data-enabled={enabled}
        >
            {enabled ? (
                <CheckCircleIcon size={16}/>
            ) : (
                <CloseCircleIcon size={16}/>
            )}
            {enabled ? (
                <FormattedMessage
                    id='admin.session_attributes.status.enabled'
                    defaultMessage='Enabled'
                />
            ) : (
                <FormattedMessage
                    id='admin.session_attributes.status.disabled'
                    defaultMessage='Disabled'
                />
            )}
        </Chip>
    );
}

const Chip = styled.span<{$enabled: boolean}>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: ${({$enabled}) => ($enabled ? 'var(--center-channel-color)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};

    svg {
        color: ${({$enabled}) => ($enabled ? 'var(--online-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.48)')};
    }
`;
