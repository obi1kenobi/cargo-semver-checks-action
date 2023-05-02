import * as fs from "fs";
import { join } from "path";
import * as crypto from "crypto";

import { hashFiles } from "../src/utils";
import { hashElement } from "folder-hash";

test("test hashFiles on ** pattern", async () => {
    const tmpDir = await fs.promises.mkdtemp("cargo-semver-checks-action-test");
    await fs.promises.writeFile(join(tmpDir, "Cargo.lock"), "test1");
    await fs.promises.mkdir(join(tmpDir, "inner"));
    await fs.promises.writeFile(join(tmpDir, "inner", "Cargo.lock"), "test2");

    const hashAll = await hashFiles([join(tmpDir, "**", "Cargo.lock")]);

    const hashNodeOuter = await hashElement(join(tmpDir, "Cargo.lock"));
    const hashNodeInner = await hashElement(join(tmpDir, "inner", "Cargo.lock"));

    await fs.promises.rm(tmpDir, { recursive: true });

    const hasher = crypto.createHash("md5");
    hasher.update(hashNodeOuter.hash);
    hasher.update(hashNodeInner.hash);
    expect(hashAll).toBe(hasher.digest("hex"));
});
