import subprocess,re,sys,collections,json
repo=sys.argv[1] if len(sys.argv)>1 else '.'
revision=sys.argv[2] if len(sys.argv)>2 else 'HEAD'
objects=subprocess.check_output(['git','-C',repo,'rev-list','--objects',revision]).splitlines()
paths={line.split(b' ',1)[0]:line.split(b' ',1)[1].decode(errors='replace') if b' ' in line else '(commit)' for line in objects}
proc=subprocess.Popen(['git','-C',repo,'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
patterns={'google_api_key':rb'AIza[A-Za-z0-9_-]{35}','private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','stripe_live':rb'(?:sk|rk)_live_[A-Za-z0-9]{20,}','github_token':rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'}
findings={};unique={k:set() for k in patterns}
for oid,path in paths.items():
 proc.stdin.write(oid+b'\n');proc.stdin.flush()
 header=proc.stdout.readline().split();data=proc.stdout.read(int(header[2]));proc.stdout.read(1)
 for label,pat in patterns.items():
  matches=re.findall(pat,data)
  if matches:findings.setdefault(label,set()).add(path);unique[label].update(matches)
proc.stdin.close();proc.wait()
print(json.dumps({'objects':len(objects),'findings':{k:{'distinct_values':len(unique[k]),'paths':sorted(v)} for k,v in findings.items()}},indent=2))
sys.exit(1 if findings else 0)
