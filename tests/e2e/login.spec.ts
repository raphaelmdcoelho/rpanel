import { expect, test } from "@playwright/test";

const EMAIL = "admin@example.com";
const PASSWORD = "correct horse battery";

// Runs against a fresh stack (see scripts/e2e.sh), so the first visit is the first-run setup.
test("first-run setup, then log out and back in", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Create the first account" })).toBeVisible();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("Password must be");

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}`)).toBeVisible();
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(`Signed in as ${EMAIL}`)).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("wrong password here");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}`)).toBeVisible();
});
