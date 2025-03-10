// *****************************************************************************
// Copyright (C) 2021 TypeFox and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import * as fs from 'fs-extra';
import { inject, injectable, named } from 'inversify';
import { ContributionProvider } from '../../common';
import { Localization } from '../../common/i18n/localization';
import { LocalizationProvider } from './localization-provider';

export const LocalizationContribution = Symbol('LocalizationContribution');

export interface LocalizationContribution {
    registerLocalizations(registry: LocalizationRegistry): Promise<void>;
}

@injectable()
export class LocalizationRegistry {

    @inject(LocalizationProvider)
    protected readonly localizationProvider: LocalizationProvider;

    @inject(ContributionProvider) @named(LocalizationContribution)
    protected readonly contributions: ContributionProvider<LocalizationContribution>;

    async initialize(): Promise<void> {
        await Promise.all(this.contributions.getContributions().map(
            contribution => contribution.registerLocalizations(this)
        ));
    }

    registerLocalization(localization: Localization): void {
        this.localizationProvider.addLocalizations(localization);
    }

    registerLocalizationFromRequire(locale: string, required: unknown): void {
        const translations = this.flattenTranslations(required);
        const localization: Localization = {
            languageId: locale,
            translations
        };
        this.registerLocalization(localization);
    }

    async registerLocalizationFromFile(localizationPath: string, locale?: string): Promise<void> {
        if (!locale) {
            locale = this.identifyLocale(localizationPath);
        }
        if (!locale) {
            throw new Error('Could not determine locale from path.');
        }
        const translationJson = await fs.readJson(localizationPath);
        const translations = this.flattenTranslations(translationJson);
        const localization: Localization = {
            languageId: locale,
            translations
        };
        this.registerLocalization(localization);
    }

    protected flattenTranslations(localization: unknown): Record<string, string> {
        if (typeof localization === 'object' && localization) {
            const record: Record<string, string> = {};
            for (const [key, value] of Object.entries(localization)) {
                if (typeof value === 'string') {
                    record[key] = value;
                } else if (value && typeof value === 'object') {
                    const flattened = this.flattenTranslations(value);
                    for (const [flatKey, flatValue] of Object.entries(flattened)) {
                        record[`${key}/${flatKey}`] = flatValue;
                    }
                }
            }
            return record;
        } else {
            return {};
        }
    }

    protected identifyLocale(localizationPath: string): string | undefined {
        const regex = /nls\.(\w+)\.json$/i;
        const match = regex.exec(localizationPath);
        if (match) {
            return match[1];
        }
        return undefined;
    }
}
