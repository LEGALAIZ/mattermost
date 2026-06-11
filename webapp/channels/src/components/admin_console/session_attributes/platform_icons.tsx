// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';
import styled from 'styled-components';

import {MonitorIcon, CellphoneIcon, GlobeIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import {SESSION_PLATFORMS, type SessionPlatform} from './utils';

const ICONS: Record<SessionPlatform, ComponentType<IconProps>> = {
    desktop: MonitorIcon,
    mobile: CellphoneIcon,
    browser: GlobeIcon,
};

type Props = {
    platforms: SessionPlatform[];
};

export default function PlatformIcons({platforms}: Props) {
    const {formatMessage} = useIntl();

    return (
        <Row data-testid='session-attribute-platforms'>
            {SESSION_PLATFORMS.map((platform) => {
                const Icon = ICONS[platform];
                const active = platforms.includes(platform);

                return (
                    <IconSlot
                        key={platform}
                        $active={active}
                        data-platform={platform}
                        data-active={active}
                    >
                        <Icon
                            size={18}
                            aria-label={formatMessage(platformLabels[platform])}
                        />
                    </IconSlot>
                );
            })}
        </Row>
    );
}

const platformLabels = defineMessages({
    desktop: {id: 'admin.session_attributes.platform.desktop', defaultMessage: 'Desktop'},
    mobile: {id: 'admin.session_attributes.platform.mobile', defaultMessage: 'Mobile'},
    browser: {id: 'admin.session_attributes.platform.browser', defaultMessage: 'Browser'},
});

const Row = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 8px;
`;

const IconSlot = styled.span<{$active: boolean}>`
    display: inline-flex;
    align-items: center;
    color: var(--center-channel-color);
    opacity: ${({$active}) => ($active ? 1 : 0.32)};
`;
