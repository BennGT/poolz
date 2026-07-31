# My Pool Pal Play Store Launch Checklist

App name: My Pool Pal  
Android package ID: `com.mypoolpal.app`  
Play Store upload file: `android/app/build/outputs/bundle/release/app-release.aab`

## 1. Store Listing Text

Google Play limits the app name to 30 characters, the short description to 80 characters, and the full description to 4000 characters.

App name:

```text
My Pool Pal
```

Short description:

```text
Pool chemical dosing from your own water test readings.
```

Full description:

```text
My Pool Pal helps pool and spa owners turn water test results into clear chemical dosing guidance.

Use your preferred testing method, including pool test strips, liquid test kits, or digital testing equipment. Enter your measured readings, choose your pool profile, and calculate dosing recommendations for common pool chemicals.

Features:
- Save multiple pool profiles
- Enter readings for chlorine, bromine, pH, alkalinity, hardness, stabiliser, salt, and temperature
- Set and edit your own target ranges
- Calculate chemical dosing based on pool volume
- Use the built-in volume calculator if you are not sure of your pool size
- View safety guidance before adding chemicals
- Save test history and export records

My Pool Pal is designed as a practical pool maintenance companion. It provides general dosing recommendations only. Always follow product label instructions, avoid mixing chemicals, and seek advice from a qualified pool or water treatment professional when needed.
```

Suggested screenshots:

1. Splash/start screen with the large My Pool Pal logo.
2. My Pool page showing a saved profile.
3. Chemical calculator page with test result fields.
4. Dosing results after pressing Calculate.
5. Safety page.
6. History/export page.

What you need to do in Play Console:

1. Go to Grow users > Store presence > Main store listing.
2. Paste the app name, short description, and full description above.
3. Upload the app icon and phone screenshots.
4. Save.

## 2. Privacy Policy And App Content

Current app behaviour from the code:

- Saves pool profiles and test history on the user's device using local storage.
- Allows sharing/exporting history through the device share sheet or email app.
- Does not include ads.
- Does not include analytics.
- Does not use account login.
- Does not request camera, location, contacts, microphone, SMS, or call log permissions.
- Android currently declares Internet permission because it is a Capacitor web app shell.

Privacy policy wording to use on a hosted page:

```text
Privacy Policy for My Pool Pal

My Pool Pal is a pool and spa chemical dosing calculator.

Information stored by the app
My Pool Pal lets users save pool profiles, test readings, target ranges, chemical settings, and test history. This information is stored locally on the user's device.

How information is used
The saved information is used to calculate chemical dosing recommendations and show test history inside the app.

Sharing and export
Users can choose to export or share their test history using their device's share or email options. My Pool Pal does not automatically send this information to the developer.

Ads and analytics
My Pool Pal does not currently use advertising SDKs or analytics SDKs.

Accounts
My Pool Pal does not currently require user accounts or login.

Disclaimer
Recommendations are provided as a general guide only. Always follow product label instructions and seek advice from a qualified pool or water treatment professional when needed.

Contact
For privacy questions, contact: [your support email]
```

What you need to do:

1. Choose the support email address you want public.
2. Host this privacy policy online, ideally on your Netlify site as `/privacy.html`.
3. In Play Console go to Policy and programs > App content > Privacy Policy.
4. Paste the live privacy policy URL.
5. In App content, answer:
   - Ads: No
   - Target audience: likely adults/general pool and spa owners, not children
   - Data safety: local device storage only unless you later add accounts, analytics, cloud backup, ads, or billing data handling

## 3. Category And Contact Details

Recommended category:

```text
House & Home
```

Backup option if Google does not offer that category for your app setup:

```text
Tools
```

What you need to do:

1. Go to Grow users > Store presence > Store settings.
2. Set category to House & Home if available.
3. Add your required support email.
4. Add a website URL if you have one. The Netlify app URL is fine for now.
5. Add phone number only if you are happy for it to be public.

## 4. Internal And Closed Testing

Use internal testing first so you can install the Play Store version on your own phone quickly.

What you need to do first:

1. Go to Test and release > Testing > Internal testing.
2. Create an email list.
3. Add your own Google account email and any trusted testers.
4. Upload the `.aab` file.
5. Copy the tester opt-in link.
6. Open the link on your Android phone, opt in, then install from Google Play.

Important for new personal Google Play developer accounts:

Google may require a closed test with at least 12 opted-in testers for 14 continuous days before production access. If your account has that requirement, internal testing is still useful, but closed testing is the one that counts toward production access.

Closed testing notes to keep:

```text
Tester instructions:
Please create a pool profile, enter sample water readings, press Calculate, review safety guidance, save a test log, and export history if possible. Report any confusing wording, layout issues, crashes, or calculations that look wrong.
```

## 5. Subscriptions

Do not rush this into the first release unless you already know what should be paid. The current app can launch free first.

Suggested future products:

```text
my_pool_pal_pro_monthly
my_pool_pal_pro_yearly
```

Possible Pro features:

- Unlimited history
- Advanced export options
- Multiple saved locations
- Reminders
- Cloud backup later

What you need to do later:

1. Decide what is free and what is Pro.
2. Create subscription products in Play Console under Monetize with Play > Products > Subscriptions.
3. Do not publish paid subscriptions until the app has clear in-app wording for price, billing period, cancellation, and what users get.
4. We will need to wire Google Play Billing into the app before subscriptions can actually work.

