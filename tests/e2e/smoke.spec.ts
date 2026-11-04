import { expect, test } from "@playwright/test";

test("the web shell loads and reaches the API through nginx", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "rpanel" })).toBeVisible();
  await expect(page.getByTestId("api-status")).toHaveText("API: ok");
});
