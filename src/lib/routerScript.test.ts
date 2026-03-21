import { describe, expect, it } from "vitest";

import { extractRouterScriptVariant } from "@/lib/routerScript";

describe("extractRouterScriptVariant", () => {
  it("keeps the full script when the complete variant is selected", () => {
    const script = "bgp 64765\n router-id 10.50.255.254";

    expect(extractRouterScriptVariant(script, "completo")).toBe(script);
  });

  it("extracts the BGP block even when the template starts with the ASN only", () => {
    const script = `interface Tunnel0/0/0
 source Ethernet0/0/4
#
 64765
 router-id 10.50.129.59
 timer keepalive 10 hold 30
 peer 15.50.255.80 as-number 65055
  ipv4-family unicast
   network 10.50.129.59 255.255.255.255
   peer 15.50.255.80 enable
#
route-policy OUT_TO_BB permit node 10
 if-match ip-prefix OUT_TO_BB
#
ip ip-prefix OUT_TO_BB index 10 permit 99.244.0.0 14 greater-equal 14 less-equal 28
ip ip-prefix OUT_TO_BB index 20 permit 10.50.129.59 32
#
pim
 auto-rp listening enable`;

    const bgpScript = extractRouterScriptVariant(script, "bgp");

    expect(bgpScript).toContain("64765");
    expect(bgpScript).toContain("route-policy OUT_TO_BB");
    expect(bgpScript).toContain("ip ip-prefix OUT_TO_BB index 20");
    expect(bgpScript).not.toContain("interface Tunnel0/0/0");
    expect(bgpScript).not.toContain("pim");
  });

  it("extracts the BGP support blocks from HP templates", () => {
    const script = `bgp 64765
 router-id 10.50.255.254
 timer keepalive 10 hold 30
 peer 18.50.255.83 as-number 65055
 #
 address-family ipv4 unicast
  network 10.50.255.254 255.255.255.255
  peer 18.50.255.83 enable
multicast routing
route-policy OUT_TO_BB permit node 10
 if-match ip address prefix-list OUT_TO_BB
#
 ip prefix-list OUT_TO_BB index 10 permit 99.244.0.0 14 less-equal 28
 ip prefix-list OUT_TO_BB index 20 permit 10.50.255.254 32
#
 ip as-path 31 permit _65050$`;

    const bgpScript = extractRouterScriptVariant(script, "bgp");

    expect(bgpScript).toContain("bgp 64765");
    expect(bgpScript).toContain("route-policy OUT_TO_BB permit node 10");
    expect(bgpScript).toContain("ip prefix-list OUT_TO_BB index 20 permit 10.50.255.254 32");
    expect(bgpScript).not.toContain("multicast routing");
    expect(bgpScript).not.toContain("ip as-path 31 permit");
  });

  it("extracts NQA entries, schedules and server enable lines", () => {
    const script = `nqa entry wan_vrrp 50
 type icmp-echo
  destination ip 10.98.0.1
 nqa schedule wan_vrrp 50 start-time now lifetime forever
interface LoopBack1
 ip address 10.50.255.254 255.255.255.255
 nqa server enable
user-interface vty 0 4`;

    const nqaScript = extractRouterScriptVariant(script, "nqa");

    expect(nqaScript).toContain("nqa entry wan_vrrp 50");
    expect(nqaScript).toContain("nqa schedule wan_vrrp 50 start-time now lifetime forever");
    expect(nqaScript).toContain("nqa server enable");
    expect(nqaScript).not.toContain("interface LoopBack1");
    expect(nqaScript).not.toContain("user-interface vty 0 4");
  });
});
