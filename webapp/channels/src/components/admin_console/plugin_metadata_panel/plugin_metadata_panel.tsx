// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import ExternalLink from 'components/external_link';

import {copyToClipboard} from 'utils/utils';

import './plugin_metadata_panel.scss';

export function formatPluginVersion(version: string): string {
    if (!version) {
        return version;
    }

    return (/^v/i).test(version) ? version : `v${version}`;
}

export type PluginMetadataPanelProps = {
    name: string;
    id: string;
    version: string;
    homepageUrl?: string;
    releaseNotesUrl?: string;
    className?: string;
};

const copyMessages = defineMessages({
    copied: {
        id: 'copied.message',
        defaultMessage: 'Copied',
    },
    copyText: {
        id: 'copy.text.message',
        defaultMessage: 'Copy text',
    },
});

const PluginMetadataId = ({id}: {id: string}) => {
    const intl = useIntl();
    const [isCopied, setIsCopied] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const copyId = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        setIsCopied(true);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            setIsCopied(false);
        }, 2000);

        copyToClipboard(id);
    };

    const tooltipMessage = isCopied ? copyMessages.copied : copyMessages.copyText;

    return (
        <WithTooltip
            title={<FormattedMessage {...tooltipMessage}/>}
        >
            <span
                className='PluginMetadataPanel__id'
                data-testid='plugin-metadata-id'
                onClick={copyId}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        copyId(e);
                    }
                }}
                role='button'
                tabIndex={0}
                aria-label={intl.formatMessage(tooltipMessage)}
            >
                {id}
            </span>
        </WithTooltip>
    );
};

const PluginMetadataPanel = ({
    name,
    id,
    version,
    homepageUrl,
    releaseNotesUrl,
    className,
}: PluginMetadataPanelProps) => {
    const displayName = name.trim() || id;
    const formattedVersion = formatPluginVersion(version);

    let nameElement: React.ReactNode = <strong>{displayName}</strong>;
    if (homepageUrl) {
        nameElement = (
            <ExternalLink
                href={homepageUrl}
                location='plugin_metadata_panel'
            >
                <strong>{displayName}</strong>
            </ExternalLink>
        );
    }

    let versionElement: React.ReactNode = null;
    if (formattedVersion) {
        versionElement = (
            <>
                {' - '}
                {releaseNotesUrl ? (
                    <ExternalLink
                        href={releaseNotesUrl}
                        location='plugin_metadata_panel'
                        data-testid='plugin-metadata-version'
                    >
                        {formattedVersion}
                    </ExternalLink>
                ) : (
                    <span data-testid='plugin-metadata-version'>
                        {formattedVersion}
                    </span>
                )}
            </>
        );
    }

    return (
        <span
            className={classNames('PluginMetadataPanel', className)}
            data-testid='plugin-metadata-panel'
        >
            {nameElement}
            <span className='PluginMetadataPanel__metadata'>
                {' ('}
                <PluginMetadataId id={id}/>
                {versionElement}
                {')'}
            </span>
        </span>
    );
};

export default PluginMetadataPanel;
