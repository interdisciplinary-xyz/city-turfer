# Screenshots for PR #227 (scope/v0.16.0)

Shot on `dfe8c2b` (app and web) and `5b95076`/`4394858` (gap pass; no app-code change in between). 229 images, demo account and mock data only; every image checked before publishing. Policy: `docs/process/release-manager.md`, "Screenshots in release PRs".

- [App (90)](#app)
- [App (13)](#android)
- [Website (28)](#web)
- [Portal (50)](#portal)
- [Admin (Payload, throwaway local database and staff@example.com) (7)](#admin)
- [Swagger (6)](#swagger)
- [Storybook (35)](#storybook)

<a id="app"></a>
## App: iOS Simulator, iPhone 17 Pro (01–90 first pass; 100–120 account, code sign-in, permissions, live recording, Polish)

| | | | |
|---|---|---|---|
| <img src="app/01-sign-in-empty.png" width="170"><br><sub>01-sign-in-empty</sub> | <img src="app/02-sign-in-password-filled.png" width="170"><br><sub>02-sign-in-password-filled</sub> | <img src="app/03-dashboard-top.png" width="170"><br><sub>03-dashboard-top</sub> | <img src="app/04-dashboard-city-recent-achievements.png" width="170"><br><sub>04-dashboard-city-recent-achievements</sub> |
| <img src="app/06-stats-tab.png" width="170"><br><sub>06-stats-tab</sub> | <img src="app/07-turf-map-city.png" width="170"><br><sub>07-turf-map-city</sub> | <img src="app/08-turf-map-all.png" width="170"><br><sub>08-turf-map-all</sub> | <img src="app/09-turf-map-zoomed.png" width="170"><br><sub>09-turf-map-zoomed</sub> |
| <img src="app/10-turf-map-attribution-popup.png" width="170"><br><sub>10-turf-map-attribution-popup</sub> | <img src="app/100-sign-in-code-email-entered.png" width="170"><br><sub>100-sign-in-code-email-entered</sub> | <img src="app/101-sign-in-code-step.png" width="170"><br><sub>101-sign-in-code-step</sub> | <img src="app/102-sign-in-code-filled.png" width="170"><br><sub>102-sign-in-code-filled</sub> |
| <img src="app/103-dashboard-after-code-sign-in.png" width="170"><br><sub>103-dashboard-after-code-sign-in</sub> | <img src="app/104-account-overview-cloud-account.png" width="170"><br><sub>104-account-overview-cloud-account</sub> | <img src="app/105-account-name-edit.png" width="170"><br><sub>105-account-name-edit</sub> | <img src="app/106-account-email-change.png" width="170"><br><sub>106-account-email-change</sub> |
| <img src="app/107-account-password-set.png" width="170"><br><sub>107-account-password-set</sub> | <img src="app/108-account-export-my-data.png" width="170"><br><sub>108-account-export-my-data</sub> | <img src="app/109-account-delete-confirm.png" width="170"><br><sub>109-account-delete-confirm</sub> | <img src="app/11-turf-map-run-filter-off.png" width="170"><br><sub>11-turf-map-run-filter-off</sub> |
| <img src="app/110-record-location-permission-idle.png" width="170"><br><sub>110-record-location-permission-idle</sub> | <img src="app/111-record-location-denied.png" width="170"><br><sub>111-record-location-denied</sub> | <img src="app/112-record-location-denied-start-tapped.png" width="170"><br><sub>112-record-location-denied-start-tapped</sub> | <img src="app/113-share-photo-camera-denied-explainer.png" width="170"><br><sub>113-share-photo-camera-denied-explainer</sub> |
| <img src="app/114-recording-live-gdansk-replay.png" width="170"><br><sub>114-recording-live-gdansk-replay</sub> | <img src="app/115-dashboard-live-session-banner.png" width="170"><br><sub>115-dashboard-live-session-banner</sub> | <img src="app/116-recording-live-trail.png" width="170"><br><sub>116-recording-live-trail</sub> | <img src="app/117-pl-record-recording.png" width="170"><br><sub>117-pl-record-recording</sub> |
| <img src="app/118-pl-stats.png" width="170"><br><sub>118-pl-stats</sub> | <img src="app/119-pl-achievements.png" width="170"><br><sub>119-pl-achievements</sub> | <img src="app/12-districts-list.png" width="170"><br><sub>12-districts-list</sub> | <img src="app/120-pl-finish-share-prompt.png" width="170"><br><sub>120-pl-finish-share-prompt</sub> |
| <img src="app/13-districts-selected.png" width="170"><br><sub>13-districts-selected</sub> | <img src="app/14-me-menu.png" width="170"><br><sub>14-me-menu</sub> | <img src="app/15-home-city-picker.png" width="170"><br><sub>15-home-city-picker</sub> | <img src="app/16-home-city-picker-search.png" width="170"><br><sub>16-home-city-picker-search</sub> |
| <img src="app/17-daily-goal-editor.png" width="170"><br><sub>17-daily-goal-editor</sub> | <img src="app/19-profile.png" width="170"><br><sub>19-profile</sub> | <img src="app/20-achievements.png" width="170"><br><sub>20-achievements</sub> | <img src="app/21-achievements-scrolled.png" width="170"><br><sub>21-achievements-scrolled</sub> |
| <img src="app/22-dashboard-goal-card-top.png" width="170"><br><sub>22-dashboard-goal-card-top</sub> | <img src="app/23-account-settings.png" width="170"><br><sub>23-account-settings</sub> | <img src="app/24-info-top.png" width="170"><br><sub>24-info-top</sub> | <img src="app/25-info-scroll-1.png" width="170"><br><sub>25-info-scroll-1</sub> |
| <img src="app/26-info-scroll-2.png" width="170"><br><sub>26-info-scroll-2</sub> | <img src="app/28-history-list.png" width="170"><br><sub>28-history-list</sub> | <img src="app/29-activity-detail-top.png" width="170"><br><sub>29-activity-detail-top</sub> | <img src="app/30-share-photo-source-sheet.png" width="170"><br><sub>30-share-photo-source-sheet</sub> |
| <img src="app/31-share-card-top-place-off.png" width="170"><br><sub>31-share-card-top-place-off</sub> | <img src="app/32-share-card-controls.png" width="170"><br><sub>32-share-card-controls</sub> | <img src="app/33-share-card-place-city.png" width="170"><br><sub>33-share-card-place-city</sub> | <img src="app/34-share-card-district-bottom-layout.png" width="170"><br><sub>34-share-card-district-bottom-layout</sub> |
| <img src="app/35-share-card-turf-line-off-place-off.png" width="170"><br><sub>35-share-card-turf-line-off-place-off</sub> | <img src="app/36-activity-detail-bottom.png" width="170"><br><sub>36-activity-detail-bottom</sub> | <img src="app/37-activity-rename-dialog.png" width="170"><br><sub>37-activity-rename-dialog</sub> | <img src="app/38-activity-delete-confirmation.png" width="170"><br><sub>38-activity-delete-confirmation</sub> |
| <img src="app/39-record-idle.png" width="170"><br><sub>39-record-idle</sub> | <img src="app/40-record-started-before-movement.png" width="170"><br><sub>40-record-started-before-movement</sub> | <img src="app/41-recording-live-turf-overlay.png" width="170"><br><sub>41-recording-live-turf-overlay</sub> | <img src="app/42-recording-live-later.png" width="170"><br><sub>42-recording-live-later</sub> |
| <img src="app/43-recording-paused-manually.png" width="170"><br><sub>43-recording-paused-manually</sub> | <img src="app/44-finish-share-prompt.png" width="170"><br><sub>44-finish-share-prompt</sub> | <img src="app/45-recorded-summary-stats-turf.png" width="170"><br><sub>45-recorded-summary-stats-turf</sub> | <img src="app/46-share-card-after-recording.png" width="170"><br><sub>46-share-card-after-recording</sub> |
| <img src="app/50-pl-info-language.png" width="170"><br><sub>50-pl-info-language</sub> | <img src="app/51-pl-record-idle.png" width="170"><br><sub>51-pl-record-idle</sub> | <img src="app/52-pl-history.png" width="170"><br><sub>52-pl-history</sub> | <img src="app/53-pl-activity-detail.png" width="170"><br><sub>53-pl-activity-detail</sub> |
| <img src="app/54-pl-share-photo-card.png" width="170"><br><sub>54-pl-share-photo-card</sub> | <img src="app/55-pl-turf-map.png" width="170"><br><sub>55-pl-turf-map</sub> | <img src="app/56-pl-me-menu.png" width="170"><br><sub>56-pl-me-menu</sub> | <img src="app/57-pl-dashboard.png" width="170"><br><sub>57-pl-dashboard</sub> |
| <img src="app/60-info-cloud-backup-offer.png" width="170"><br><sub>60-info-cloud-backup-offer</sub> | <img src="app/61-cloud-backup-code-screen.png" width="170"><br><sub>61-cloud-backup-code-screen</sub> | <img src="app/62-cloud-backup-linked.png" width="170"><br><sub>62-cloud-backup-linked</sub> | <img src="app/64-account-settings-linked.png" width="170"><br><sub>64-account-settings-linked</sub> |
| <img src="app/70-empty-turf-map-no-city.png" width="170"><br><sub>70-empty-turf-map-no-city</sub> | <img src="app/71-empty-record-no-city.png" width="170"><br><sub>71-empty-record-no-city</sub> | <img src="app/72-empty-dashboard-city-card-no-city.png" width="170"><br><sub>72-empty-dashboard-city-card-no-city</sub> | <img src="app/80-remove-demo-confirm.png" width="170"><br><sub>80-remove-demo-confirm</sub> |
| <img src="app/81-empty-dashboard.png" width="170"><br><sub>81-empty-dashboard</sub> | <img src="app/82-empty-stats.png" width="170"><br><sub>82-empty-stats</sub> | <img src="app/83-turf-map-one-walk-after-demo-removed.png" width="170"><br><sub>83-turf-map-one-walk-after-demo-removed</sub> | <img src="app/84-dashboard-one-activity-bottom.png" width="170"><br><sub>84-dashboard-one-activity-bottom</sub> |
| <img src="app/85-empty-after-last-activity-deleted.png" width="170"><br><sub>85-empty-after-last-activity-deleted</sub> | <img src="app/86-empty-stats.png" width="170"><br><sub>86-empty-stats</sub> | <img src="app/87-empty-history.png" width="170"><br><sub>87-empty-history</sub> | <img src="app/88-empty-turf-map.png" width="170"><br><sub>88-empty-turf-map</sub> |
| <img src="app/89-empty-achievements.png" width="170"><br><sub>89-empty-achievements</sub> | <img src="app/90-first-run-getting-started-checklist.png" width="170"><br><sub>90-first-run-getting-started-checklist</sub> |   |   |

<a id="android"></a>
## App: Android emulator, API 35 (partial: the emulator failed under host load)

| | | | |
|---|---|---|---|
| <img src="android/01-sign-in-email-empty.png" width="170"><br><sub>01-sign-in-email-empty</sub> | <img src="android/02-sign-in-password-step.png" width="170"><br><sub>02-sign-in-password-step</sub> | <img src="android/03-dashboard-top.png" width="170"><br><sub>03-dashboard-top</sub> | <img src="android/04-dashboard-bottom.png" width="170"><br><sub>04-dashboard-bottom</sub> |
| <img src="android/05-stats.png" width="170"><br><sub>05-stats</sub> | <img src="android/06-turf-map.png" width="170"><br><sub>06-turf-map</sub> | <img src="android/07-districts.png" width="170"><br><sub>07-districts</sub> | <img src="android/08-history.png" width="170"><br><sub>08-history</sub> |
| <img src="android/09-activity-detail.png" width="170"><br><sub>09-activity-detail</sub> | <img src="android/10-share-photo-source-sheet.png" width="170"><br><sub>10-share-photo-source-sheet</sub> | <img src="android/11-share-photo-card.png" width="170"><br><sub>11-share-photo-card</sub> | <img src="android/12-record-idle.png" width="170"><br><sub>12-record-idle</sub> |
| <img src="android/13-record-recording-geo-replay.png" width="170"><br><sub>13-record-recording-geo-replay</sub> |   |   |   |

<a id="web"></a>
## Website: landing /en and /pl at 390, 768, 1440; 404; /branding

| | | |
|---|---|---|
| <img src="web/404-full-1440.png" width="260"><br><sub>404-full-1440</sub> | <img src="web/404-pl-full-1440.png" width="260"><br><sub>404-pl-full-1440</sub> | <img src="web/branding-first-screen-1440.png" width="260"><br><sub>branding-first-screen-1440</sub> |
| <img src="web/branding-full-1440.png" width="260"><br><sub>branding-full-1440</sub> | <img src="web/landing-en-first-screen-1440.png" width="260"><br><sub>landing-en-first-screen-1440</sub> | <img src="web/landing-en-first-screen-390.png" width="260"><br><sub>landing-en-first-screen-390</sub> |
| <img src="web/landing-en-first-screen-768.png" width="260"><br><sub>landing-en-first-screen-768</sub> | <img src="web/landing-en-full-1440.png" width="260"><br><sub>landing-en-full-1440</sub> | <img src="web/landing-en-full-390.png" width="260"><br><sub>landing-en-full-390</sub> |
| <img src="web/landing-en-full-768.png" width="260"><br><sub>landing-en-full-768</sub> | <img src="web/landing-en-header-1440.png" width="260"><br><sub>landing-en-header-1440</sub> | <img src="web/landing-en-header-390.png" width="260"><br><sub>landing-en-header-390</sub> |
| <img src="web/landing-en-header-768.png" width="260"><br><sub>landing-en-header-768</sub> | <img src="web/landing-en-hero-1440.png" width="260"><br><sub>landing-en-hero-1440</sub> | <img src="web/landing-en-hero-390.png" width="260"><br><sub>landing-en-hero-390</sub> |
| <img src="web/landing-en-hero-768.png" width="260"><br><sub>landing-en-hero-768</sub> | <img src="web/landing-pl-first-screen-1440.png" width="260"><br><sub>landing-pl-first-screen-1440</sub> | <img src="web/landing-pl-first-screen-390.png" width="260"><br><sub>landing-pl-first-screen-390</sub> |
| <img src="web/landing-pl-first-screen-768.png" width="260"><br><sub>landing-pl-first-screen-768</sub> | <img src="web/landing-pl-full-1440.png" width="260"><br><sub>landing-pl-full-1440</sub> | <img src="web/landing-pl-full-390.png" width="260"><br><sub>landing-pl-full-390</sub> |
| <img src="web/landing-pl-full-768.png" width="260"><br><sub>landing-pl-full-768</sub> | <img src="web/landing-pl-header-1440.png" width="260"><br><sub>landing-pl-header-1440</sub> | <img src="web/landing-pl-header-390.png" width="260"><br><sub>landing-pl-header-390</sub> |
| <img src="web/landing-pl-header-768.png" width="260"><br><sub>landing-pl-header-768</sub> | <img src="web/landing-pl-hero-1440.png" width="260"><br><sub>landing-pl-hero-1440</sub> | <img src="web/landing-pl-hero-390.png" width="260"><br><sub>landing-pl-hero-390</sub> |
| <img src="web/landing-pl-hero-768.png" width="260"><br><sub>landing-pl-hero-768</sub> |   |   |

<a id="portal"></a>
## Portal: sign-in, register, account, activities (demo account)

| | | |
|---|---|---|
| <img src="portal/account-backup-1440.png" width="260"><br><sub>account-backup-1440</sub> | <img src="portal/account-backup-390.png" width="260"><br><sub>account-backup-390</sub> | <img src="portal/account-delete-confirmation-1440.png" width="260"><br><sub>account-delete-confirmation-1440</sub> |
| <img src="portal/account-delete-confirmation-390.png" width="260"><br><sub>account-delete-confirmation-390</sub> | <img src="portal/account-delete-your-account-1440.png" width="260"><br><sub>account-delete-your-account-1440</sub> | <img src="portal/account-delete-your-account-390.png" width="260"><br><sub>account-delete-your-account-390</sub> |
| <img src="portal/account-get-a-copy-1440.png" width="260"><br><sub>account-get-a-copy-1440</sub> | <img src="portal/account-get-a-copy-390.png" width="260"><br><sub>account-get-a-copy-390</sub> | <img src="portal/account-home-first-screen-768.png" width="260"><br><sub>account-home-first-screen-768</sub> |
| <img src="portal/account-home-full-1440.png" width="260"><br><sub>account-home-full-1440</sub> | <img src="portal/account-home-full-390.png" width="260"><br><sub>account-home-full-390</sub> | <img src="portal/account-home-full-768.png" width="260"><br><sub>account-home-full-768</sub> |
| <img src="portal/account-home-pl-full-1440.png" width="260"><br><sub>account-home-pl-full-1440</sub> | <img src="portal/account-home-pl-full-390.png" width="260"><br><sub>account-home-pl-full-390</sub> | <img src="portal/account-signed-in-devices-1440.png" width="260"><br><sub>account-signed-in-devices-1440</sub> |
| <img src="portal/account-signed-in-devices-390.png" width="260"><br><sub>account-signed-in-devices-390</sub> | <img src="portal/account-what-we-store-1440.png" width="260"><br><sub>account-what-we-store-1440</sub> | <img src="portal/account-what-we-store-390.png" width="260"><br><sub>account-what-we-store-390</sub> |
| <img src="portal/account-your-account-1440.png" width="260"><br><sub>account-your-account-1440</sub> | <img src="portal/account-your-account-390.png" width="260"><br><sub>account-your-account-390</sub> | <img src="portal/activities-list-1440.png" width="260"><br><sub>activities-list-1440</sub> |
| <img src="portal/activities-list-390.png" width="260"><br><sub>activities-list-390</sub> | <img src="portal/activities-list-768.png" width="260"><br><sub>activities-list-768</sub> | <img src="portal/activities-list-first-screen-1440.png" width="260"><br><sub>activities-list-first-screen-1440</sub> |
| <img src="portal/activities-list-first-screen-390.png" width="260"><br><sub>activities-list-first-screen-390</sub> | <img src="portal/activities-list-first-screen-768.png" width="260"><br><sub>activities-list-first-screen-768</sub> | <img src="portal/activities-list-pl-first-screen-390.png" width="260"><br><sub>activities-list-pl-first-screen-390</sub> |
| <img src="portal/activity-detail-1440.png" width="260"><br><sub>activity-detail-1440</sub> | <img src="portal/activity-detail-390.png" width="260"><br><sub>activity-detail-390</sub> | <img src="portal/activity-detail-768.png" width="260"><br><sub>activity-detail-768</sub> |
| <img src="portal/register-en-code-1440.png" width="260"><br><sub>register-en-code-1440</sub> | <img src="portal/register-en-code-390.png" width="260"><br><sub>register-en-code-390</sub> | <img src="portal/register-en-code-768.png" width="260"><br><sub>register-en-code-768</sub> |
| <img src="portal/register-en-email-1440.png" width="260"><br><sub>register-en-email-1440</sub> | <img src="portal/register-en-email-390.png" width="260"><br><sub>register-en-email-390</sub> | <img src="portal/register-en-email-768.png" width="260"><br><sub>register-en-email-768</sub> |
| <img src="portal/register-pl-code-1440.png" width="260"><br><sub>register-pl-code-1440</sub> | <img src="portal/register-pl-code-390.png" width="260"><br><sub>register-pl-code-390</sub> | <img src="portal/register-pl-code-768.png" width="260"><br><sub>register-pl-code-768</sub> |
| <img src="portal/register-pl-email-1440.png" width="260"><br><sub>register-pl-email-1440</sub> | <img src="portal/register-pl-email-390.png" width="260"><br><sub>register-pl-email-390</sub> | <img src="portal/register-pl-email-768.png" width="260"><br><sub>register-pl-email-768</sub> |
| <img src="portal/sign-in-code-1440.png" width="260"><br><sub>sign-in-code-1440</sub> | <img src="portal/sign-in-code-390.png" width="260"><br><sub>sign-in-code-390</sub> | <img src="portal/sign-in-email-1440.png" width="260"><br><sub>sign-in-email-1440</sub> |
| <img src="portal/sign-in-email-390.png" width="260"><br><sub>sign-in-email-390</sub> | <img src="portal/sign-in-pl-code-1440.png" width="260"><br><sub>sign-in-pl-code-1440</sub> | <img src="portal/sign-in-pl-code-390.png" width="260"><br><sub>sign-in-pl-code-390</sub> |
| <img src="portal/sign-in-pl-email-1440.png" width="260"><br><sub>sign-in-pl-email-1440</sub> | <img src="portal/sign-in-pl-email-390.png" width="260"><br><sub>sign-in-pl-email-390</sub> |   |

<a id="admin"></a>
## Admin (Payload, throwaway local database and staff@example.com)

| | |
|---|---|
| <img src="admin/account-1440.png" width="300"><br><sub>account-1440</sub> | <img src="admin/dashboard-1440.png" width="300"><br><sub>dashboard-1440</sub> |
| <img src="admin/login-1440.png" width="300"><br><sub>login-1440</sub> | <img src="admin/login-390.png" width="300"><br><sub>login-390</sub> |
| <img src="admin/staff-create-1440.png" width="300"><br><sub>staff-create-1440</sub> | <img src="admin/staff-edit-1440.png" width="300"><br><sub>staff-edit-1440</sub> |
| <img src="admin/staff-list-1440.png" width="300"><br><sub>staff-list-1440</sub> |   |

<a id="swagger"></a>
## Swagger: site and API

| | |
|---|---|
| <img src="swagger/swagger-api-full-1440.png" width="300"><br><sub>swagger-api-full-1440</sub> | <img src="swagger/swagger-api-operation-1440.png" width="300"><br><sub>swagger-api-operation-1440</sub> |
| <img src="swagger/swagger-api-top-1440.png" width="300"><br><sub>swagger-api-top-1440</sub> | <img src="swagger/swagger-web-full-1440.png" width="300"><br><sub>swagger-web-full-1440</sub> |
| <img src="swagger/swagger-web-operation-1440.png" width="300"><br><sub>swagger-web-operation-1440</sub> | <img src="swagger/swagger-web-top-1440.png" width="300"><br><sub>swagger-web-top-1440</sub> |

<a id="storybook"></a>
## Storybook: one story per component

| | |
|---|---|
| <img src="storybook/app-activityrow--run-1440.png" width="300"><br><sub>app-activityrow--run-1440</sub> | <img src="storybook/app-badge--activity-1440.png" width="300"><br><sub>app-badge--activity-1440</sub> |
| <img src="storybook/app-button--primary-1440.png" width="300"><br><sub>app-button--primary-1440</sub> | <img src="storybook/app-card--default-1440.png" width="300"><br><sub>app-card--default-1440</sub> |
| <img src="storybook/app-daystrip--default-1440.png" width="300"><br><sub>app-daystrip--default-1440</sub> | <img src="storybook/app-native-placeholders--turf-map-1440.png" width="300"><br><sub>app-native-placeholders--turf-map-1440</sub> |
| <img src="storybook/app-progressbar--default-1440.png" width="300"><br><sub>app-progressbar--default-1440</sub> | <img src="storybook/app-shareoverlay--white-photo-1440.png" width="300"><br><sub>app-shareoverlay--white-photo-1440</sub> |
| <img src="storybook/app-stat--default-1440.png" width="300"><br><sub>app-stat--default-1440</sub> | <img src="storybook/app-turflegend--default-1440.png" width="300"><br><sub>app-turflegend--default-1440</sub> |
| <img src="storybook/foundations-tokens--all-1440.png" width="300"><br><sub>foundations-tokens--all-1440</sub> | <img src="storybook/foundations-typography--typefaces-1440.png" width="300"><br><sub>foundations-typography--typefaces-1440</sub> |
| <img src="storybook/portal-activityhistory--list-1440.png" width="300"><br><sub>portal-activityhistory--list-1440</sub> | <img src="storybook/portal-deleteaccount--closed-1440.png" width="300"><br><sub>portal-deleteaccount--closed-1440</sub> |
| <img src="storybook/portal-devicespanel--three-devices-1440.png" width="300"><br><sub>portal-devicespanel--three-devices-1440</sub> | <img src="storybook/portal-exportpanel--idle-1440.png" width="300"><br><sub>portal-exportpanel--idle-1440</sub> |
| <img src="storybook/portal-messages--all-1440.png" width="300"><br><sub>portal-messages--all-1440</sub> | <img src="storybook/portal-pages--privacy-and-data-1440.png" width="300"><br><sub>portal-pages--privacy-and-data-1440</sub> |
| <img src="storybook/portal-privacysections--backup-on-1440.png" width="300"><br><sub>portal-privacysections--backup-on-1440</sub> | <img src="storybook/portal-signinform--email-step-1440.png" width="300"><br><sub>portal-signinform--email-step-1440</sub> |
| <img src="storybook/start-1440.png" width="300"><br><sub>start-1440</sub> | <img src="storybook/website-appheader--english-1440.png" width="300"><br><sub>website-appheader--english-1440</sub> |
| <img src="storybook/website-hero--coming-soon-1440.png" width="300"><br><sub>website-hero--coming-soon-1440</sub> | <img src="storybook/website-hero-city-map--gdansk-1440.png" width="300"><br><sub>website-hero-city-map--gdansk-1440</sub> |
| <img src="storybook/website-herocopy--default-1440.png" width="300"><br><sub>website-herocopy--default-1440</sub> | <img src="storybook/website-heroscreens--default-1440.png" width="300"><br><sub>website-heroscreens--default-1440</sub> |
| <img src="storybook/website-homesections--default-1440.png" width="300"><br><sub>website-homesections--default-1440</sub> | <img src="storybook/website-icons--all-icons-1440.png" width="300"><br><sub>website-icons--all-icons-1440</sub> |
| <img src="storybook/website-languageswitcher--english-1440.png" width="300"><br><sub>website-languageswitcher--english-1440</sub> | <img src="storybook/website-page--launch-1440.png" width="300"><br><sub>website-page--launch-1440</sub> |
| <img src="storybook/website-pageloader--loading-1440.png" width="300"><br><sub>website-pageloader--loading-1440</sub> | <img src="storybook/website-revealmotion--default-1440.png" width="300"><br><sub>website-revealmotion--default-1440</sub> |
| <img src="storybook/website-sitefooter--default-1440.png" width="300"><br><sub>website-sitefooter--default-1440</sub> | <img src="storybook/website-storebuttons--coming-soon-1440.png" width="300"><br><sub>website-storebuttons--coming-soon-1440</sub> |
| <img src="storybook/website-waitlist--default-1440.png" width="300"><br><sub>website-waitlist--default-1440</sub> |   |
