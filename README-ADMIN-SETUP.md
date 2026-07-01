# Fiaz Website Admin Setup

This version removes Decap/Netlify completely.

## What changed

- `/admin` is now a custom editor.
- It saves directly to GitHub through Cloudflare Pages Functions.
- No Netlify Identity, no Decap CMS, no OAuth Worker.

## Cloudflare settings needed

In Cloudflare Pages, open:

`Workers & Pages -> fiaz-website-clean -> Settings -> Variables and Secrets`

Add these two secrets to the **Pages project**:

1. `ADMIN_PASSWORD`
   - Any password you want for the admin login.

2. `GITHUB_TOKEN`
   - A GitHub fine-grained personal access token.
   - It needs access to this repository: `thejackal262/Fiaz-website-clean`
   - Repository permissions needed: **Contents: Read and write**

After adding both secrets, redeploy the Pages project.

## Login

Open:

`https://fiaz-website-clean.pages.dev/admin`

Enter your `ADMIN_PASSWORD`.

## Important

When you press **Save website**, the admin commits to GitHub. Cloudflare then redeploys automatically, usually within 30-90 seconds.
