# BIX project rules
- Preserve local browser records and existing backups when changing schemas.
- User authorizes commits and pushes to https://github.com/Dawensky009/Bix.git after each coherent tested change batch. Never push broken intermediate edits or force-push. Verify remote SHA after pushing.
- No production deployment without separate authorization.
- Run unit tests, production build and browser workflows for behavior changes. Test light/dark mobile and desktop when changing UI.
- No broker credentials, fake performance or cloud services without explicit scope change.
- Visual direction: user-selected dark cyan dashboard with equivalent light theme; references and contract in PRODUCT.md and .impeccable/surface.md.
