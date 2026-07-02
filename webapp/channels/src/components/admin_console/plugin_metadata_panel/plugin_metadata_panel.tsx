// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import CopyButton from 'components/copy_button';
import ExternalLink from 'components/external_link';

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
                <span className='PluginMetadataPanel__idWrapper'>
                    <span
                        className='PluginMetadataPanel__id'
                        data-testid='plugin-metadata-id'
                    >
                        {id}
                    </span>
                    <CopyButton
                        content={id}
                        isForText={true}
                        className='PluginMetadataPanel__copy'
                    />
                </span>
                {versionElement}
                {')'}
            </span>
        </span>
    );
};

export default PluginMetadataPanel;
