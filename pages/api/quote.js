import { bridges, dexes, quote } from "./utils";

export default async function handler(req, res) {
  try {
    const inputAsset = req.query.in;
    const outputAsset = req.query.out;
    const amount = parseFloat(req.query.amount);
    let routes = [];

    for (let b of bridges.concat(dexes)) {
      if (b.assets.includes(inputAsset)) {
        for (let a of b.assets) {
          if (a == inputAsset) continue;
          routes.push({
            swaps: [
              {
                connection: b,
                input: inputAsset,
                output: a,
                inputAmount: amount,
                outputAmount: await quote(b.id, inputAsset, a, amount),
              },
            ],
          });
        }
      }
    }

    for (let d of dexes) {
      for (let r of routes) {
        const lastSwap = r.swaps[r.swaps.length - 1];
        if (lastSwap.connection.type == "dex") continue;
        if (lastSwap.output === outputAsset) continue;
        if (!d.assets.includes(lastSwap.output)) continue;
        if (!d.assets.includes(outputAsset)) continue;
        r.swaps.push({
          connection: d,
          input: lastSwap.output,
          output: outputAsset,
          inputAmount: lastSwap.outputAmount,
          outputAmount: await quote(
            d.id,
            lastSwap.output,
            outputAsset,
            lastSwap.outputAmount
          ),
        });
      }
    }

    routes = routes.filter(
      (r) => r.swaps[r.swaps.length - 1].output == outputAsset
    );
    routes = routes.map((r) => {
      r.out = r.swaps[r.swaps.length - 1].outputAmount;
      return r;
    });

    if (routes.length == 0) {
      res.status(200).json({ error: "no possible route found" });
      return;
    }
    res.status(200).json({ out: routes[0].out, routes });
  } catch (err) {
    res.status(200).json({ error: "internal error (" + err.message + ")" });
  }
}
